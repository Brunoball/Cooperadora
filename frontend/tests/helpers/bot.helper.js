// Solo simula el Panel Bot. Las APIs administrativas se consultan realmente.
function botMock(url) {
  if (!url.pathname.includes('/bot_wp/')) return null;
  const file = url.pathname.split('/').pop();
  const responses = {
    'panel_chats.php': { success: true, chats: [] },
    'etiquetas_list.php': { success: true, etiquetas: [] },
    'panel_eventos.php': { success: true, eventos: [], total: 0 },
    'panel_global_hash.php': { success: true, hash: 'coop-test-empty' },
    'panel_hash.php': { success: true, hash: 'coop-test-empty' },
    'panel_mensajes.php': { success: true, mensajes: [] },
  };
  return { body: responses[file], file };
}
module.exports = { botMock };
