const _host = window.location.hostname;
const API_BASE = _host === 'localhost' || _host === '127.0.0.1'
  ? `http://${_host}:8080`
  : `http://${_host}/api`;
