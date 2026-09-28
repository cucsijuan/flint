// Loaded on demand by math.ts: MathJax is large and most notes have no math.
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/js/svg.js'
import { browserAdaptor } from '@mathjax/src/js/adaptors/browserAdaptor.js'
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js'
import { TeX } from '@mathjax/src/js/input/tex.js'
import '@mathjax/src/js/input/tex/action/ActionConfiguration.js'
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js'
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js'
import '@mathjax/src/js/input/tex/bbm/BbmConfiguration.js'
import '@mathjax/src/js/input/tex/bboldx/BboldxConfiguration.js'
import '@mathjax/src/js/input/tex/bbox/BboxConfiguration.js'
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js'
import '@mathjax/src/js/input/tex/braket/BraketConfiguration.js'
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js'
import '@mathjax/src/js/input/tex/cases/CasesConfiguration.js'
import '@mathjax/src/js/input/tex/centernot/CenternotConfiguration.js'
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js'
import '@mathjax/src/js/input/tex/dsfont/DsfontConfiguration.js'
import '@mathjax/src/js/input/tex/empheq/EmpheqConfiguration.js'
import '@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js'
import '@mathjax/src/js/input/tex/extpfeil/ExtpfeilConfiguration.js'
import '@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js'
import '@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js'
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js'
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js'
import '@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js'
import '@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js'
import '@mathjax/src/js/input/tex/textcomp/TextcompConfiguration.js'
import '@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js'
import '@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js'
import '@mathjax/src/js/input/tex/units/UnitsConfiguration.js'
import '@mathjax/src/js/input/tex/upgreek/UpgreekConfiguration.js'
import '@mathjax/src/js/input/tex/verb/VerbConfiguration.js'
import { mathjax } from '@mathjax/src/js/mathjax.js'
import { SVG } from '@mathjax/src/js/output/svg.js'

const PACKAGES = [
  'base',
  'action',
  'ams',
  'bbm',
  'bboldx',
  'bbox',
  'boldsymbol',
  'braket',
  'cancel',
  'cases',
  'centernot',
  'color',
  'dsfont',
  'empheq',
  'enclose',
  'extpfeil',
  'gensymb',
  'mathtools',
  'mhchem',
  'newcommand',
  'noundefined',
  'physics',
  'textcomp',
  'textmacros',
  'unicode',
  'units',
  'upgreek',
  'verb',
]

const FONT_FOLDER = '/node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/'
const dynamicFonts = import.meta.glob(
  '/node_modules/@mathjax/mathjax-newcm-font/mjs/svg/dynamic/*.js',
)

// The font loads rarely used glyph ranges on demand; serve them from the bundle.
mathjax.asyncLoad = (name: string) => {
  const file = name.slice(name.lastIndexOf('/') + 1)
  const load = dynamicFonts[FONT_FOLDER + (file.endsWith('.js') ? file : `${file}.js`)]
  return load ? load() : Promise.reject(new Error(`MathJax can't load ${name}`))
}

const adaptor = browserAdaptor()
RegisterHTMLHandler(adaptor)
const output = new SVG({ fontData: MathJaxNewcmFont, fontCache: 'local' })
const html = mathjax.document(document, {
  InputJax: new TeX({ packages: PACKAGES }),
  OutputJax: output,
})
document.head.append(output.styleSheet(html) as Node)

export const typeset = (tex: string, display: boolean): Promise<HTMLElement> =>
  mathjax.handleRetriesFor(() => html.convert(tex, { display }) as HTMLElement)
