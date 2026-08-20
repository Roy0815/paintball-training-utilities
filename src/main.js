import './style.css';
import { renderShell } from './app/shell.js';
import { startRouter } from './app/router.js';

const root = document.querySelector('#app');
const view = renderShell(root);
startRouter(view);
