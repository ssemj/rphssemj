fetch('https://script.google.com/macros/s/AKfycbycWrxMkguWZC12f60eGClC1jI_7qPegcGFbbnGh1QIJFC0yPNQG7lCUlOlt-SkAht3/exec?action=getData')
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data.bundles[0], null, 2));
  });
