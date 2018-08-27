(function () {
  var code = 'UA-17159207-10';

  var s = document.createElement('script');
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + code;
  s.async = 1;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', code);
}());
