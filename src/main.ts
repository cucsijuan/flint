import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'
import { isMobile } from './lib/platform'

// Touch-sized controls everywhere; see the end of app.css.
if (isMobile) document.documentElement.classList.add('mobile')

export default mount(App, { target: document.body })
