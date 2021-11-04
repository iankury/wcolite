$(document).ready(() => {
  $('body').addClass('loaded_hiding')
  setTimeout(() => {
    $('body').addClass('loaded')
    $('body').removeClass('loaded_hiding')
  }, 500)
})

$('.about__button').click(() => {
  $('.popup-about').addClass('_active')
  $('body').addClass('_lock')
})

$('.popup-about__close').click(() => {
  $('.popup-about').removeClass('_active')
  $('body').removeClass('_lock')
})

$('.arrow._down').click(() => {
  $('.modules')[0].scrollIntoView({ behavior: 'smooth' })
})

$('.arrow._up').click(() => {
  $('.wrapper')[0].scrollIntoView({ behavior: 'smooth' })
})

