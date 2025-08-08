/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";

import '@/styles/App.css';
import '@/styles/Theme.css';
import '@/styles/Titlebar.css';
import '@/styles/Utilities.css';


render(() => <App />, document.getElementById("root") as HTMLElement);