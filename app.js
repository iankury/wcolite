function Initialize() {
  const pinha = fs.readFileSync('pinha.txt')
  unifiedJson = JSON.parse(pinha)
  jsonTree = fs.readFileSync('tree.txt')
  BuildQueryToNode()
}

const homeComputer = process.env.COMPUTERNAME == 'PINHATA'
const express = require('express'), app = express()
const fs = require('fs')
const fetch = require('node-fetch')
const levenshtein = require('js-levenshtein')
const LRU = require("lru-cache")
const {performance} = require('perf_hooks')

const secret = fs.readFileSync('secret.txt').toString()
const decode = s => s.split('a').map(x => String.fromCharCode(x)).join('')
const StripTags = s => s.replace(/(<([^>]+)>)/gi, '')
const StripParentheses = s => s.replace(/[()]/g, '')
const StripAuthorship = s => s.replace(/[,()&]/g, '')
const ShortRefFromSourceName = s => s.substr(0, s.indexOf(')') + 1)
const StripDagger = s => {
  if (s.charCodeAt(0) == 8224) 
    s = s.substr(1).trim()
  return s
}
const IsDigitCode = n => n >= '0'.charCodeAt(0) && n <= '9'.charCodeAt(0)
const NameAuthorYearLink = x => 
  `<div class="qlink">${x.original_html}</div> ${x.stripped_author_year}`
const NameAuthorYear = x => `${x.original_html} ${x.stripped_author_year}`
const NameLink = s => `<div class="qlink">${s}</div>`

const cache = new LRU(10000)
let jsonTree
let jsonFromApi = {}, unifiedJson = {}, citationMap = {}, queryToNode = {}, sourceMap = {}
let fetchQueue
let fetchPending = false
const queryPage = {
  taxon_names: 0,
  citations: 0,
  taxon_name_relationships: 0,
  sources: 0
}
let debugging = false
let t0FullFetch = 0

const kTaxonRootId = '321566', kPageSize = 15

const supportedRelationships = ['replaced by', 'type species', 
    'synonym', 'classified as', 'homonym', 'unnecessary replacement for']

function ShortRefFromObj (x, type) {
  const citationObj = citationMap[x.id]

  if (citationObj && citationObj['pages']) {
    return `${NameLink(x.original_html)}${type == 'aponym' ? ':' : ''} ${ShortRefFromSourceName(x.source)}: ${citationObj['pages']}`
  }
  return `${NameAuthorYear(x)} (citation incomplete)`
}

app.use(express.static('public', { index: 'home.html' }))

Initialize()

app.listen(process.env.PORT || 3000)

app.get('/q/:id', (req, res) => {
  if (req.params.id.length > 1000)
    res.sendStatus(400)
  else {
    const decodedQuery = decode(req.params.id)
    if (decodedQuery.length > 80)
      res.sendStatus(400)
    else
      res.status(201).send(Process(decodedQuery))
  }
})
app.get('/t', (req, res) => res.status(201).send(fetchPending ? null : jsonTree))
app.get(secret, (req, res) => {
  if (fetchPending)
    res.sendFile('public/pending.html', { root: __dirname })
  else {
    fetchPending = true
    LoadFromApi()
    res.sendFile('public/updating.html', { root: __dirname })
  }
})

function AddToTable(key, x) {
  if (!(key in queryToNode))
    queryToNode[key] = new Set()
  queryToNode[key].add(x)
}

function BuildQueryToNode() {
  Object.values(unifiedJson).forEach(x => {
    if (x['cached'] && x['author_year']) {
      const sciname = x['cached'].toLowerCase()
      AddToTable(sciname, x)
      const authorship = x['author_year'].toLowerCase()
      AddToTable(authorship, x)
      const tokens = StripAuthorship(authorship).split(' ')
      tokens.forEach(token => AddToTable(token, x))
    }
  })
  Object.values(unifiedJson).forEach(x => {
    const s = x['original'].toLowerCase()
    if (!queryToNode[s]) 
      queryToNode[s] = queryToNode[x['cached'].toLowerCase()]
  })
}

function Process(query) {
  const pageNumber = parseInt(query.substr(0, 4))
  query = StripDagger(query.substr(4))

  let ans = {
    approximation: false,
    didYouMean: '',
    resultList: [],
    pages: 1
  }
  if (queryToNode[query])
    ans.resultList = Array.from(queryToNode[query])
  else {
    const fromCache = cache.get(query)
    if (fromCache)
      ans = fromCache
    else {
      ans.resultList = SubstringMatch(query)
      if (ans.resultList.length == 0) {
        ans.approximation = true
        ans.didYouMean = BestApproximation(query)
      }
      cache.set(query, ans)
    }
  }

  if (!ans.approximation) {
    ans.pages = Math.ceil(ans.resultList.length / kPageSize)
    const st = pageNumber * kPageSize
    ans.resultList = ans.resultList.slice(st, st + kPageSize)
  }

  return JSON.stringify(ans)
}

function SubstringMatch(s) {
  let ans = new Set()
  Object.entries(queryToNode).forEach(x => {
    const key = x[0]
    const value = x[1]
    if (value && !IsDigitCode(key.charCodeAt(0)) && key.includes(s))
      ans = new Set([...ans, ...value])
  })
  return Array.from(ans)
}

function BestApproximation(s) {
  let ans = ''
  let best = 99999
  for (const key of Object.keys(queryToNode)) {
    if (IsDigitCode(key.charCodeAt(0)))
      continue
    const distance = levenshtein(s, key)
    if (distance < best) {
      best = distance
      ans = key
    }
  }
  return ans
}

function queryString(title) {
  const options = {
    path: 'https://sfg.taxonworks.org/api/v1/',
    title: title,
    params: {
      token: 'W8kIg_iBpBG72j2EZZLhVQ',
      project_id: 10,
      per: 9500,
      page: ++queryPage[title]
    }
  }
  if (title == 'sources')
    options['params']['in_project'] = true
  const paramsString = Object.entries(options.params).map(x => `${x[0]}=${x[1]}`).join('&')
  return `${options.path}${options.title}?${paramsString}`
}

function Fetch() {
  const t0 = performance.now()
  const x = fetchQueue.pop()
  const reqStr = queryString(x)
  Log(`Making ${x} API request\n${reqStr}`)
  fetch(reqStr)
    .then(res => res.text())
    .then(text => {
      const json = JSON.parse(text)
      if (json.length > 0) {
        jsonFromApi[x] = [ ...jsonFromApi[x], ...json ]
        fetchQueue.push(x) // Try next page as long as we don't get an empty page
      }
      const elapsed = ((performance.now() - t0) / 1000.0).toFixed(2)
      Log(`Got ${json.length} elements (${elapsed} s)`)
      setTimeout(function () {
        if (fetchQueue.length > 0)
          Fetch()
        else { // Finished fetching everything
          totalElapsed = ((performance.now() - t0FullFetch) / 1000.0).toFixed(2)
          Log(`Total elapsed time: ${totalElapsed} s`)
          if (debugging)
            SaveLoadedJson()
          else
            LoadedJson()
        }
      }, fetchQueue.length > 0 ? 3000 : 300)
    })
}

function LoadFromApi() {
  t0FullFetch = performance.now()
  fetchQueue = ['taxon_names', 'citations', 'taxon_name_relationships', 'sources']
  for (x of fetchQueue) 
    if (jsonFromApi[x] == undefined)
      jsonFromApi[x] = []
  Fetch()
}

function LoadedJson() {
  MakeSourceMap()
  Unify()
  KillGhosts()
  KillProtonymParentheses()
  AddValid()
  MapCitationObjIdToCitation()
  AddLogonymy()
  AddParentHtml()
  AddAncestree()
  AddChildren()
  jsonTree = JSON.stringify(BuildTree(kTaxonRootId))
  Write()
}

function MakeSourceMap() {
  jsonFromApi['sources'].forEach(x => {
    sourceMap[x.id] = x.cached
  })
}

function Unify() {
  jsonFromApi['taxon_names'].forEach(x => {
    unifiedJson[x.id] = {
      id: x.id,
      parent_id: x.parent_id,
      cached: x.cached,
      cached_html: x.cached_html,
      original: x.cached_original_combination || x.cached,
      original_html: x.cached_original_combination_html || x.cached_html,
      rank: x.rank,
      type: x.type,
      valid_taxon_name_id: x.cached_valid_taxon_name_id,
      author_year: x.cached_author_year,
      year: x.year,
      speciesCount: 'Not applicable',
    }
  })
  jsonFromApi['citations'].forEach(x => {
    const el = unifiedJson[x.citation_object_id]
    if (el) {
      el['pages'] = x.pages
      el['is_original'] = x.is_original
      el['source'] = sourceMap[x.source_id] || ''
    }
  })
}

function KillGhosts() {
  to_delete = []
  Object.entries(unifiedJson).forEach(x => {
    key = x[0]
    value = x[1]
    if (!value['id'])
      to_delete.push(key)
  })
  to_delete.forEach(x => delete unifiedJson[x])
}

function KillProtonymParentheses() {
  Object.values(unifiedJson).forEach(x => {
    x['stripped_author_year'] = x['type'] == 'Protonym' && x['author_year'] ?
      StripParentheses(x['author_year']) : x['author_year']
  })
}

function AddValid() {
  Object.entries(unifiedJson).forEach(x => {
    const key = x[0]
    const value = x[1]
    value['valid'] = value['valid_taxon_name_id'] == key
    value['protonyms'] = []
    value['aponyms'] = []
    value['references'] = new Set()
    value['relationships'] = []
    if (!value['valid'])
      value['validName'] = unifiedJson[value['valid_taxon_name_id']]['original_html']
  })
}

function MapCitationObjIdToCitation() {
  jsonFromApi['citations'].forEach(x => {
    const key = x.citation_object_id
    citationMap[key] = x
  })
}

function ResolveTagType(subjectTag) {
  for (x of supportedRelationships)
    if (subjectTag.includes(x))
      return x
  return subjectTag
}

function AddRelationship(tagType, subjectId, objectId, relationshipId, subjectTag) {
  const juniorObj = unifiedJson[subjectId]
  const seniorObj = unifiedJson[objectId]
  let citationObj = citationMap[relationshipId] || { pages: 0 }
  let ref = 'Reference missing'
  if (citationObj && citationObj['source_id']) 
    ref = sourceMap[citationObj['source_id']]
  if (juniorObj && seniorObj && ref) {
    const shortRef = `${ShortRefFromSourceName(ref)}: ${citationObj['pages']}`
    let interpolation, receiver
    switch (tagType) {
      case 'synonym':
        interpolation = 'is a junior '
        receiver = seniorObj
        break;
      case 'classified as':
        interpolation = ''
        receiver = juniorObj
        break;
      case 'homonym':
        interpolation = 'is a junior '
        receiver = juniorObj
        break;
      case 'replaced by':
        interpolation = ''
        receiver = seniorObj
        break;
      case 'unnecessary replacement for':
        interpolation = 'is an '
        receiver = seniorObj
        break;
    }
    if (!receiver['valid'])
      receiver = unifiedJson[receiver['valid_taxon_name_id']]
    const msg = `${NameAuthorYearLink(juniorObj)} ${interpolation}${subjectTag} ${NameAuthorYearLink(seniorObj)} in ${shortRef} <span class=\"relationship_tag\">relationship</span>`
    receiver['relationships'].push({ id: relationshipId, msg: msg })
    receiver['references'].add(ref)
  }
}

function AddLogonymy() {
  let otherTagTypes = {}
  jsonFromApi['taxon_name_relationships'].forEach(x => {
    const relationshipId = x['id']
    const subjectId = x['subject_taxon_name_id']
    const objectId = x['object_taxon_name_id']
    const subjectTag = x['subject_status_tag']
    if (subjectTag) {
      const tagType = ResolveTagType(subjectTag)
      if (tagType == 'type species') {
        const speciesObj = unifiedJson[subjectId]
        const genusObj = unifiedJson[objectId]
        if (speciesObj && genusObj) {
          genusObj['type_species'] = `${subjectTag}: ${NameAuthorYearLink(speciesObj)}`
          genusObj['type_species'] = genusObj['type_species'].charAt(0).toUpperCase() + genusObj['type_species'].slice(1)
        }
      } else if (supportedRelationships.includes(tagType)) {
        AddRelationship(tagType, subjectId, objectId, relationshipId, subjectTag)
      } else if (homeComputer) {
        if (tagType in otherTagTypes)
          otherTagTypes[tagType]++
        else
          otherTagTypes[tagType] = 1
      }
    }
  })
  // Log('Other types:')
  // Log(Object.entries(otherTagTypes))

  Object.values(unifiedJson).forEach(x => {
    if (x['valid']) {
      if (x['type'] == 'Protonym') {
        x.protonyms.push({ id: x['id'], msg: `${ShortRefFromObj(x, 'protonym')} <span class=\"protonym_tag\">protonym</span>` })
        if (x['type_species'])
          x.protonyms.push({ id: x['id'], msg: x['type_species'] })
      }
      else{
        formattedAponym = `${ShortRefFromObj(x, 'aponym')} <span class=\"aponym_tag\">aponym</span>`
        x.aponyms.push({ id: x['id'], msg: formattedAponym })
      }
      x['references'].add(x['source'])
    }
    else {
      const ergonym = unifiedJson[x['valid_taxon_name_id']]
      if (x['type'] == 'Protonym') {
        ergonym.protonyms.push({ id: x['id'], msg: `${ShortRefFromObj(x, 'protonym')} <span class=\"protonym_tag\">protonym</span>`})
        if (x['type_species'])
          ergonym.protonyms.push({ id: x['id'], msg: x['type_species'] })
      }
      else {
        formattedAponym = `${ShortRefFromObj(x, 'aponym')} <span class=\"aponym_tag\">aponym</span>`
        ergonym.aponyms.push({ id: x['id'], msg: formattedAponym })
      }
      ergonym['references'].add(x['source'])
    }
  })

  relationshipMap = {}
  Object.values(jsonFromApi['taxon_name_relationships']).forEach(x => {
    subId = x['subject_taxon_name_id']
    if (subId) {
      if (!(subId in relationshipMap))
        relationshipMap[subId] = {}
      objId = x['object_taxon_name_id'] 
      if (objId)
        relationshipMap[subId][objId] = true
      relId = x['id']
      if (relId)
        relationshipMap[subId][relId] = true
    }
  })
  
  Object.values(unifiedJson).forEach(x => {
    x['unmatched'] = []
    if (x['protonyms']) {
      for (let j = 0; j < x['protonyms'].length; j++) {
        protoId = x['protonyms'][j]['id']
        x['protonyms'][j]['aponyms'] = []
        x['protonyms'][j]['relationships'] = []
        if (relationshipMap[protoId]) {
          if (x['aponyms']) {
            for (let i = 0; i < x['aponyms'].length; i++) {
              aponym = x['aponyms'][i]
              if (relationshipMap[protoId][aponym['id']]) {
                x['protonyms'][j]['aponyms'].push(aponym['msg'])
                x['aponyms'][i]['id'] = -1
              }
            }
          }
          if (x['relationships']) {
            for (let i = 0; i < x['relationships'].length; i++) {
              relationship = x['relationships'][i]
              if (relationshipMap[protoId][relationship['id']]) {
                x['protonyms'][j]['relationships'].push(relationship['msg'])
                x['relationships'][i]['id'] = -1
              }
            }
          }
        }
      }
    }
    for (aponym of x['aponyms'])
      if (aponym['id'] != -1) // -1 means it got linked to a protonym
        x['unmatched'].push(aponym['msg'])
    for (relationship of x['relationships'])
      if (relationship['id'] != -1) // -1 means it got linked to a protonym
        x['unmatched'].push(relationship['msg'])
  })

  Object.values(unifiedJson).forEach(x => {
    x['references'] = Array.from(x['references']).sort()
  })
}

function AddParentHtml() {
  Object.values(unifiedJson).forEach(x => {
    if (x['parent_id']) {
      const pid = x['parent_id']
      if (pid in unifiedJson) {
        const node = unifiedJson[pid]
        x['parent_html'] = node['cached_html']
      }
    }
  })
}

function Ancestree(id, name) {
  if (!unifiedJson[id])
    return []
  const processedName = `<div class="qlink">${name}</div>`
  if (name == 'Animalia')
    return [ processedName ]
  const pid = unifiedJson[id].parent_id
  const pname = unifiedJson[id].parent_html
  return [ ...Ancestree(pid, pname), processedName ]
}

function AddAncestree() {
  Object.entries(unifiedJson).forEach(x => {
    const key = x[0]
    const value = x[1]
    if (value['valid'])
      value['ancestree'] = Ancestree(key, value.cached_html)
  })
}

function AddChildren() {
  Object.entries(unifiedJson).forEach(x => {
    const key = x[0]
    const value = x[1]
    if (value['parent_id'] /*&& value['cached'] != 'Opiliones'*/ && value['valid']) {
      const node = unifiedJson[value['parent_id']]
      if (!node['children_ids']) {
        node['children_ids'] = []
        node['children_names'] = []
      }
      node.children_ids.push(key)
      node.children_names.push(value['cached_html'])
    }
  })
  Object.values(unifiedJson).forEach(x => {
    if (x['children_names'])
      x['children_names'] = x['children_names'].sort((a, b) => StripTags(a).localeCompare(StripTags(b)))
  })
}

function BuildTree(u) {
  const node = unifiedJson[u]
  if (!node)
    return null
  let speciesCount = node.rank == 'species' ? 1 : 0
  const ans = {
    name: node.cached_html,
    children: []
  }
  let allowIncertaeSedis = IncertaeSedisAllowed(node)
  if (node.children_ids) {
    node.children_ids.forEach(v => {
      const rec = BuildTree(v)
      const child = unifiedJson[v]
      if (rec) {
        if (allowIncertaeSedis && child.rank == 'genus') {
          let IS
          ans.children.forEach(x => {
            if (x.name == 'Incertae Sedis')
              IS = x
          })
          if (!IS) {
            ans.children.push({
              name: 'Incertae Sedis',
              children: []
            })
            IS = ans.children[ans.children.length - 1]
          }
          IS.children.push(rec)
        }
        else
          ans.children.push(rec)
        speciesCount += child.speciesCount
      }
    })
  }
  node.speciesCount = speciesCount
  ans.children = ans.children.sort((a, b) => StripTags(a.name).localeCompare(StripTags(b.name)))
  return ans
}

function IncertaeSedisAllowed(node) {
  let allowIncertaeSedis = true
  if (node.rank.includes('genus') || node.rank.includes('species') 
      || node.rank == 'subfamily' || node.rank == 'tribe')
    allowIncertaeSedis = false
  else if (node.rank == 'family') {
    allowIncertaeSedis = false
    for (i = 0; i < node.children_ids.length; i++) {
      const child_id = node.children_ids[i]
      if (unifiedJson[child_id].rank == 'subfamily' || unifiedJson[child_id].rank == 'tribe') {
        allowIncertaeSedis = true
        break
      }
    }
  }
  return allowIncertaeSedis
}

function Write() {
  fs.writeFileSync('pinha.txt', JSON.stringify(unifiedJson))
  fs.writeFileSync('tree.txt', jsonTree)
  fetchPending = false
  Log('Wrote files pinha.txt & tree.txt')
  setTimeout(() => process.exit(), 500)
}

function Log(s) {
  if (homeComputer) 
    console.log(s)
}

function SaveJsonForDebug() {
  if (!homeComputer)
    return
  debugging = true
  LoadFromApi()
}

function SaveLoadedJson() {
  if (!homeComputer)
    return
  fs.writeFileSync('./jsonfromapi.json', JSON.stringify(jsonFromApi))
  Log('Saved jsonFromApi to file.')
  setTimeout(() => process.exit(), 500)
}

// Load raw json from file and process
function Debug() {
  if (!homeComputer)
    return
  jsonFromApi = JSON.parse(fs.readFileSync('./jsonfromapi.json'))
  Log('Loaded jsonFromApi from file.')
  LoadedJson()

  // for (x of Object.values(jsonFromApi['taxon_name_relationships'])) {
  //   if (x['subject_taxon_name_id'] && x['subject_taxon_name_id'].toString().includes('679327')) {
  //     console.log(x)
  //   }
  // }
}

// SaveJsonForDebug()
// Debug()