import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment'

export default function prismIncludeLanguages(PrismObject) {
  if (ExecutionEnvironment.canUseDOM) {
    PrismObject.languages.cedar = PrismObject.languages.extend('clike', {
      comment: {
        pattern: /\/\/.*/,
        greedy: true,
      },
      entityRef: {
        pattern: /\b[A-Z][A-Za-z0-9_]*::"(?:\\.|[^"\\])*"/,
        greedy: true,
        alias: 'class-name',
      },
      string: {
        pattern: /"(?:\\.|[^"\\])*"/,
        greedy: true,
      },
      boolean: /\b(?:true|false)\b/,
      keyword: /\b(?:permit|forbid|when|unless|in|entity|principal|action|resource|context)\b/,
      builtin: /\b(?:String|Long|Bool|Set|Record)\b/,
      operator: /==|!=|<=|>=|&&|\|\||[!<>:=]/,
      punctuation: /[()[\]{};,]/,
    })
  }
}
