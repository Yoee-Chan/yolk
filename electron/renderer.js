window.addEventListener('DOMContentLoaded', () => {
  const msgEl = document.getElementById('msg');
  msgEl.innerText = 'Calling Python...';

  window.api
    .callPython({ name: 'Chan' })
    .then((res) => {
      msgEl.innerText = res.msg || 'No message from Python';
    })
    .catch((err) => {
      msgEl.innerText = 'Error: ' + err;
    });
});
