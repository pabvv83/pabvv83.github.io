/* =====================================================================
   DADOS DO SITE — edite aqui, sem mexer na lógica de renderização.
   ---------------------------------------------------------------------
   Cada lista alimenta uma seção:
     links    → seção LINKS    (lista à esquerda + painel de detalhes)
     contacts → seção CONTATO  (mesma interface)
     files    → seção ARQUIVOS (gerenciador de arquivos)

   Campos de links e contacts
     id           identificador único (sem espaços)
     name         nome exibido
     category     categoria exibida abaixo do nome
     description  texto do painel de detalhes
     url          destino real (https://…, mailto:…). Se faltar, o item
                  só aparece se tiver "copy".
     icon         nome do ícone (veja js/icons.js → SITE_ICONS.names)
     status       opcional: texto de status exibido no painel
     actionLabel  texto do botão principal
     value        opcional: endereço/identificador exibido (e copiado)
     copy         opcional: true (copia "value") ou { label, value }
     extra        opcional: [{ label, value }] linhas adicionais

   Campos de files
     id, name, type (pdf, zip, png, md, …), description, size ("52 KiB"),
     url (caminho relativo, ex.: "files/curriculo.pdf", ou https://…),
     actionLabel, download (true para forçar download)

   Itens com URL inválida (por exemplo "javascript:") são ignorados.
   ===================================================================== */
window.SITE_DATA = {

  links: [
    {
      id: 'github',
      name: 'GitHub',
      category: 'Código / Repositórios',
      description: 'Perfil no GitHub com meus repositórios e projetos.',
      url: 'https://github.com/pabvv83',
      icon: 'code',
      actionLabel: 'VISITAR PERFIL'
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      category: 'Redes sociais',
      description: 'Perfil no TikTok.',
      url: 'https://tiktok.com/@pabvv83',
      icon: 'broadcast',
      actionLabel: 'VISITAR PERFIL'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      category: 'Redes sociais',
      description: 'Perfil no Instagram.',
      url: 'https://instagram.com/pabvv83',
      icon: 'broadcast',
      actionLabel: 'VISITAR PERFIL'
    },
    {
      id: 'discord',
      name: 'Discord',
      category: 'Comunidade',
      description: 'Convite para o servidor no Discord.',
      url: 'https://discord.gg/v5CU5KkbAf',
      icon: 'chat',
      actionLabel: 'ABRIR CONVITE'
    },
    {
      id: 'playlist',
      name: 'Playlist',
      category: 'Música',
      description: 'Playlist no Spotify.',
      url: 'https://open.spotify.com/playlist/1xRUuGs2ocvIIIJN2SB4fG',
      icon: 'music',
      actionLabel: 'ABRIR PLAYLIST'
    },
    {
      id: 'steam',
      name: 'Steam',
      category: 'Jogos',
      description: 'Perfil na Steam.',
      url: 'https://steamcommunity.com/id/pabvv/',
      icon: 'game',
      actionLabel: 'VISITAR PERFIL'
    }
  ],

  contacts: [
    {
      id: 'email',
      name: 'E-mail',
      category: 'Mensagem direta',
      description: 'Envie uma mensagem por e-mail.',
      value: 'pabvv@proton.me',
      url: 'mailto:pabvv@proton.me',
      icon: 'mail',
      actionLabel: 'ENVIAR E-MAIL',
      copy: true
    },
    {
      id: 'signal',
      name: 'Signal',
      category: 'Mensageiro',
      description: 'Usuário no Signal.',
      value: '@pabvv.83',
      icon: 'shield',
      copy: { label: 'COPIAR USUÁRIO' }
    },
    {
      id: 'github',
      name: 'GitHub',
      category: 'Código / Repositórios',
      description: 'Perfil no GitHub.',
      value: 'github.com/pabvv83',
      url: 'https://github.com/pabvv83',
      icon: 'code',
      actionLabel: 'VISITAR PERFIL'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      category: 'Redes sociais',
      description: 'Perfil no Instagram.',
      url: 'https://instagram.com/pabvv83',
      icon: 'broadcast',
      actionLabel: 'VISITAR PERFIL'
    }
  ],

  // Ainda não há arquivos publicados. Exemplo de entrada:
  // { id: 'curriculo', name: 'curriculo.pdf', type: 'pdf', size: '120 KiB',
  //   description: 'Currículo em PDF.', url: 'files/curriculo.pdf',
  //   actionLabel: 'ABRIR', download: false }
  files: []
};
