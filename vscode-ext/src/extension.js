const { LanguageClient } = require('vscode-languageclient/node');
const path = require('path');

let client;

function activate(context) {
  const serverModule = path.join(__dirname, '..', '..', 'lsp', 'src', 'server.js');

  // Use command mode so Node respects "type": "module" in lsp/package.json
  const serverOptions = {
    run:   { command: 'node', args: [serverModule, '--stdio'] },
    debug: { command: 'node', args: [serverModule, '--stdio'] },
  };

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'featurescript' }],
  };

  client = new LanguageClient('featurescript', 'FeatureScript', serverOptions, clientOptions);
  client.start();
}

function deactivate() {
  if (client) return client.stop();
}

module.exports = { activate, deactivate };
