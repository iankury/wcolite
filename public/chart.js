const Chart = (mode = "normal") => {
  wwidth = window.innerWidth;
  wheight = window.innerHeight;
  const mb = wheight > wwidth;
  const treeFontSize = 0.0013 * wheight;
  // dx = wheight / (mb ? 500 : 340);
  // dy = wwidth / (mb ? 100 : 50);
  dy = 15;
  dx = 2;

  const vbw = wwidth;
  const vbh = wheight;
  margin = {
    top: "0",
    left: wwidth / (mb ? 65 : 130),
    bottom: "auto",
    right: "auto",
  };
  diagonal = d3
    .linkHorizontal()
    .x((d) => d.y)
    .y((d) => d.x);
  tree = d3.tree().nodeSize([dx, dy]);
  const root = d3.hierarchy(jsonTree);

  root.x0 = dy / 2;
  root.y0 = 0;
  root.descendants().forEach((d, i) => {
    d.id = i;
    d._children = d.children;
    if (d.depth && d.data.name.length !== 7) d.children = null;
  });

  const svg = d3
    .create("svg")
    .attr("viewBox", [-margin.left, -margin.top, vbw, vbh])
    .style("cursor", "pointer")
    .style("userSelect", "none");

  const gLink = svg
    .append("g")
    .attr("fill", "none")
    .attr("stroke", "#AEAEAE")
    .attr("stroke-opacity", 0.5)
    .attr("stroke-width", 0.1);

  const gNode = svg
    .append("g")
    .attr("cursor", "pointer")
    .attr("pointer-events", "all");

  function update(source) {
    const duration = 400;
    const nodes = root.descendants().reverse();
    const links = root.links();

    tree(root);

    let left = root;
    let right = root;
    root.eachBefore((node) => {
      if (node.x < left.x) left = node;
      if (node.x > right.x) right = node;
    });

    const height = right.x - left.x + margin.top + margin.bottom;

    const transition = svg
      .transition()
      .duration(duration)
      .attr("viewBox", [-margin.left, left.x - margin.top, vbw, vbh])
      .tween(
        "resize",
        window.ResizeObserver ? null : () => () => svg.dispatch("toggle")
      );

    const node = gNode.selectAll("g").data(nodes, (d) => d.id);

    let colorStroke = "#f8f7f7";
    if (mode == "dark") colorStroke = "#121212";

    const nodeEnter = node
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${source.y0},${source.x0})`)
      .attr("fill-opacity", 0)
      .attr("stroke-opacity", 0)
      .on("click", (d) => {
        d.children = d.children ? null : d._children;
        update(d);
      });

    nodeEnter
      .append("circle")
      .attr("r", mb ? 0.3 : 0.4)
      .attr("fill", (d) => (d._children ? "#555" : "#999"))
      .attr("stroke-width", 2);

    nodeEnter
      .append("text")
      .attr("font-family", "BenchNine")
      .attr("font-size", `${treeFontSize}px`)
      .attr("dy", "0.31em")
      .attr("x", (d) => (d._children ? -1 : 1))
      .attr("text-anchor", (d) => (d._children ? "end" : "start"))
      .html((d) => stripTags(d.data.name))
      .clone(true)
      .lower()
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 0.3)
      .attr("stroke", colorStroke);

    nodeEnter
      .selectAll("text")
      .filter((d) => isItalic(d.data.name))
      .attr("font-style", "italic");

    const nodeUpdate = node
      .merge(nodeEnter)
      .transition(transition)
      .attr("transform", (d) => `translate(${d.y},${d.x})`)
      .attr("fill-opacity", 1)
      .attr("stroke-opacity", 1);

    const nodeExit = node
      .exit()
      .transition(transition)
      .remove()
      .attr("transform", (d) => `translate(${source.y},${source.x})`)
      .attr("fill-opacity", 0)
      .attr("stroke-opacity", 0);

    const link = gLink.selectAll("path").data(links, (d) => d.target.id);

    const linkEnter = link
      .enter()
      .append("path")
      .attr("d", (d) => {
        const o = { x: source.x0, y: source.y0 };
        return diagonal({ source: o, target: o });
      });

    link.merge(linkEnter).transition(transition).attr("d", diagonal);

    link
      .exit()
      .transition(transition)
      .remove()
      .attr("d", (d) => {
        const o = { x: source.x, y: source.y };
        return diagonal({ source: o, target: o });
      });

    root.eachBefore((d) => {
      d.x0 = d.x;
      d.y0 = d.y;
    });

    addTreeRightClick();
  }

  update(root);

  return svg.node();
};
