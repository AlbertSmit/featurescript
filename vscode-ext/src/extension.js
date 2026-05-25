const { LanguageClient, TransportKind } = require('vscode-languageclient/node');
const path = require('path');

let client;

function activate(context) {
  const serverModule = path.join(__dirname, '..', '..', 'lsp', 'src', 'server.js');

  const serverOptions = {
    run:   { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
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
