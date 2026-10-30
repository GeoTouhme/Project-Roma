const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Small hook/element harness: real page handlers and effects execute, while only
// browser rendering, navigation and HTTP boundaries are replaced. Not browser E2E.
function pageHarness(file, modules = {}) {
  const hooks = [], effects = [], pending = [];
  let index = 0, tree;
  const react = {
    createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity) }; },
    useState(initial) { const i = index++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; },
    useRef(initial) { const i = index++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; },
    useMemo(fn) { return fn(); },
    useCallback(fn) { return fn; },
    useEffect(fn, deps) { const i = index++; const previous = effects[i];
      if (!previous || !deps || deps.some((d, k) => !Object.is(d, previous.deps[k]))) {
        pending.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const noop = () => {};
  const stubs = new Proxy({}, { get: (_, key) => String(key) });
  const defaults = { react, 'react-router-dom': { useParams: () => ({}), useNavigate: () => noop },
    sonner: { toast: { success: noop, error: noop, info: noop } }, '@/lib/toast': { toast: { success: noop, error: noop } },
    '@/lib/utils': { getAdminThumbnail: value => value, resolveImageUrl: value => value },
  };
  const exports = {};
  const filename = path.resolve(__dirname, '..', file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => modules[name] || defaults[name] || stubs, console,
    setTimeout: fn => { fn(); return 1; }, clearTimeout: noop,
    window: { innerWidth: 390, addEventListener: noop, removeEventListener: noop }, FormData: global.FormData,
  });
  function render() { index = 0; tree = exports.default(); return tree; }
  function nodes(predicate, node, found = []) {
    if (arguments.length < 2) node = tree;
    if (!node || typeof node !== 'object') return found;
    if (predicate(node)) found.push(node);
    for (const child of node.children || []) nodes(predicate, child, found);
    return found;
  }
  async function settle() {
    for (let i = 0; i < 8; i++) { render(); const queued = pending.splice(0); queued.forEach(fn => fn()); await new Promise(setImmediate); }
    return tree;
  }
  return { render, settle, nodes, hooks };
}
module.exports = { pageHarness };
