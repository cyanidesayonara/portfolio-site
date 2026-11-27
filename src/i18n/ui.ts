import type { PodLabels } from '../scripts/podcast/controls';
import type { Locale } from './utils';

export type ProjectKind = 'Game' | 'Desktop app' | 'Hardware' | 'Web app' | 'Mobile app' | 'Tool';

export interface StopSpec {
  id: string;
  label: string;
  short: string;
  kind: string;
  path: string;
  color: string;
  ink: string;
}

export interface KeySpec {
  keys: string[];
  label: string;
}

export interface UiDictionary {
  site: {
    title: string;
    defaultTitleSuffix: string;
    defaultDescription: string;
    skipToContent: string;
    rssTitle: string;
    rssDescription: string;
  };
  header: {
    navAria: string;
    themeToggleAria: string;
    langSwitcherAria: string;
    walkCta: string;
    nav: {
      projects: string;
      howIBuild: string;
      blog: string;
      about: string;
    };
  };
  footer: {
    contactAria: string;
    email: string;
    rss: string;
  };
  kinds: Record<ProjectKind, string>;
  common: {
    allProjects: string;
    previousProject: string;
    nextProject: string;
    moreProjectsAria: string;
    builtWith: string;
    projectFactsAria: string;
    allPosts: string;
    draftBadge: string;
    englishOnlyBadge: string;
    englishFallbackNotice: string;
    relatedPostsHeading: string;
    projectLabel: string;
    latestRelease: string;
    byTheNumbers: string;
    factWalks: string;
    factBosses: string;
    factCommits: string;
  };
  home: {
    eyebrow: string;
    headline: string;
    lede: string;
    ctaProjects: string;
    ctaHowIBuild: string;
    streetAria: string;
    workTitle: string;
    allProjectsLink: string;
    howHeading: string;
    howBody: string;
    howCta: string;
    steps: { title: string; desc: string }[];
    blogTitle: string;
    allPostsLink: string;
  };
  projectsIndex: {
    title: string;
    description: string;
    heading: string;
    intro: string;
    currentAria: string;
    earlierHeading: string;
  };
  blogIndex: {
    title: string;
    description: string;
    heading: string;
    intro: string;
    subscribeRss: string;
    postsAria: string;
  };
  about: {
    title: string;
    description: string;
    eyebrow: string;
    heading: string;
    lede: string;
    portraitAlt: string;
    sidebarAria: string;
    contactTitle: string;
    contactBody: string;
    contactCta: string;
    skillGroups: { group: string; items: string[] }[];
    howIGotHereHeading: string;
    howIGotHereP1BeforeScratch: string;
    howIGotHereScratchLink: string;
    howIGotHereP1Middle: string;
    howIGotHereP1After: string;
    howIGotHereP2: string;
    nowHeading: string;
    nowBeforeLeash: string;
    nowBetweenLeashAndStemma: string;
    nowBetweenStemmaAndCoriolis: string;
    nowBetweenCoriolisAndHow: string;
    nowHowLink: string;
    nowAfterHow: string;
    workHeading: string;
    goforeTitle: string;
    goforeBody: string;
    solidabisTitle: string;
    solidabisBody: string;
    educationHeading: string;
    educationItems: { school: string; detail: string }[];
    languagesHeading: string;
    languagesBody: string;
  };
  howIBuild: {
    title: string;
    description: string;
    eyebrow: string;
    heading: string;
    lede: string;
    statsAria: string;
    stats: { value: string; label: string }[];
    statsNote: string;
    s1Heading: string;
    s1BodyBeforeP: string;
    s1BodyMiddle: string;
    s1BodyAfterA: string;
    s2Heading: string;
    s2P1: string;
    s2P2: string;
    s3Heading: string;
    s3Lead: string;
    s3ListBeforeCode: string[];
    s3FeelCardTerm: string;
    s3FeelCardRest: string;
    s3Changelog: string;
    s4Heading: string;
    s4Body: string;
    s5Heading: string;
    s5Body: string;
  };
  walkPage: {
    title: string;
    description: string;
    eyebrow: string;
    heading: string;
    lede: string;
    creditsPrefix: string;
    creditBy: string;
  };
  notFound: {
    title: string;
    eyebrow: string;
    heading: string;
    body: string;
    cta: string;
  };
  coriolisSim: {
    sectionAria: string;
    badge: string;
    heading: string;
    quickAria: string;
    quickScenes: { idx: number; label: string }[];
    canvasAria: string;
    loading: string;
    remoteAria: string;
    remoteLabel: string;
    upAria: string;
    leftAria: string;
    okLabel: string;
    rightAria: string;
    downAria: string;
    launcher: string;
    settings: string;
    clockOverlay: string;
    back: string;
    nextScene: string;
    home: string;
    rotate: string;
    nightMode: string;
    soundOff: string;
    soundOn: string;
    fullShowcase: string;
    hint: string;
    noscriptNote: string;
  };
  streetMap: {
    ariaLabel: string;
    defaultCaption: string;
    soundOff: string;
    soundOn: string;
    restart: string;
    fillWindow: string;
    fillWindowTitle: string;
    fullscreen: string;
    fullscreenTitle: string;
    controlsAria: string;
    moreControls: string;
    stopsAria: string;
    tryBooth: string;
    closeBooth: string;
    openPage: string;
    noscriptTitle: string;
    noscriptNote: string;
    stops: StopSpec[];
    keys: KeySpec[];
  };
  podPlayer: PodLabels;
  walk3d: {
    stageAria: string;
    clickToPlay: string;
    settingsAria: string;
    soundOff: string;
    soundOn: string;
    toolbarMenu: string;
    nextSong: string;
    weatherAria: string;
    skyDay: string;
    skyRain: string;
    skyNight: string;
    camStreet: string;
    camFollow: string;
    camOverhead: string;
    restart: string;
    screenAria: string;
    fillWindow: string;
    fillWindowTitle: string;
    fullscreen: string;
    fullscreenTitle: string;
    stemmaAria: string;
    stemmaSub: string;
    stemmaCloseAria: string;
    stemsAria: string;
    stemVocals: string;
    stemDrums: string;
    stemBass: string;
    stemOther: string;
    coriolisAria: string;
    coriolisSub: string;
    coriolisCloseAria: string;
    upAria: string;
    leftAria: string;
    okLabel: string;
    rightAria: string;
    downAria: string;
    coriolisLauncher: string;
    coriolisSettings: string;
    coriolisNext: string;
    coriolisBack: string;
    touchAria: string;
    touchJump: string;
    touchBark: string;
    touchDig: string;
    touchMark: string;
    catAria: string;
    catSub: string;
    catCloseAria: string;
    catPalette: string;
    catSize: string;
    catWatch: string;
    catPounce: string;
    catCatches: string;
    podAria: string;
    podSub: string;
    podCloseAria: string;
    noscriptTitle: string;
    noscriptBody: string;
    noscriptCtaProjects: string;
    noscriptCtaHome: string;
    controlsAria: string;
    moreControls: string;
    keys: KeySpec[];
  };
}

export const UI: Record<Locale, UiDictionary> = {
  en: {
    site: {
      title: 'Santtu Nykänen',
      defaultTitleSuffix: 'Full-stack developer',
      defaultDescription:
        'Generalist full-stack developer. Web, desktop, mobile and hardware, built with a crew of AI coding agents.',
      skipToContent: 'Skip to content',
      rssTitle: 'Santtu Nykänen: blog',
      rssDescription: 'Notes on building games, tools and hardware, and on working with AI coding agents.',
    },
    header: {
      navAria: 'Main',
      themeToggleAria: 'Switch color theme',
      langSwitcherAria: 'Language',
      walkCta: 'Walk the site',
      nav: {
        projects: 'Projects',
        howIBuild: 'How I build',
        blog: 'Blog',
        about: 'About',
      },
    },
    footer: {
      contactAria: 'Contact',
      email: 'Email',
      rss: 'RSS',
    },
    kinds: {
      Game: 'Game',
      'Desktop app': 'Desktop app',
      Hardware: 'Hardware',
      'Web app': 'Web app',
      'Mobile app': 'Mobile app',
      Tool: 'Tool',
    },
    common: {
      allProjects: 'All projects',
      previousProject: 'Previous project',
      nextProject: 'Next project',
      moreProjectsAria: 'More projects',
      builtWith: 'Built with',
      projectFactsAria: 'Project facts',
      allPosts: 'All posts',
      draftBadge: 'Draft',
      englishOnlyBadge: 'EN',
      englishFallbackNotice: 'This entry is currently available in English only.',
      relatedPostsHeading: 'Related posts',
      projectLabel: 'Project',
      latestRelease: 'Latest release',
      byTheNumbers: 'By the numbers',
      factWalks: 'Walks',
      factBosses: 'Statue bosses',
      factCommits: 'Commits',
    },
    home: {
      eyebrow: 'Generalist full-stack developer',
      headline: 'Just coding.',
      lede:
        "I'm Santtu, a generalist developer and consultant at Gofore. I've spent years building software by hand, and now I build with AI agents too, held to the same standard: planned up front, tested, and reviewed before anything ships. Automated tests and CI catch regressions while feel is tuned through playtesting, giving an end result as reliable as anything I've written line by line.",
      ctaProjects: 'See the projects',
      ctaHowIBuild: 'How I build',
      streetAria: 'Take Millie for a walk',
      workTitle: "Things I've made",
      allProjectsLink: 'All projects',
      howHeading: 'I direct, the agents type.',
      howBody:
        "Briefs in, branches out, and nothing merges without passing tests and CI; every player-facing change is played and accepted before it lands. That's how a whole batch of new levels for Path of Leash Resistance gets built at once.",
      howCta: 'Read how it works',
      steps: [
        { title: 'Brief', desc: 'One written task per agent' },
        { title: 'Batch', desc: 'Parallel worktrees and branches' },
        { title: 'Ship', desc: 'Review, play, merge, release' },
      ],
      blogTitle: 'From the blog',
      allPostsLink: 'All posts',
    },
    projectsIndex: {
      title: 'Projects',
      description: 'Games, desktop apps, LED hardware and web apps by Santtu Nykänen.',
      heading: 'Projects',
      intro:
        "The things I'm proudest of: a game, a music tool and an LED wall. Further down are earlier projects from when I was learning the trade.",
      currentAria: 'Current projects',
      earlierHeading: 'Earlier work',
    },
    blogIndex: {
      title: 'Blog',
      description: 'Notes on building games, tools and hardware, and on working with AI coding agents.',
      heading: 'Blog',
      intro: 'Notes on building games, tools and hardware, and on working with AI coding agents.',
      subscribeRss: 'Subscribe with RSS',
      postsAria: 'Posts',
    },
    about: {
      title: 'About',
      description: 'Santtu Nykänen: generalist full-stack developer.',
      eyebrow: 'About',
      heading: "Hi, I'm Santtu.",
      lede:
        "A generalist full-stack developer. I've been writing software professionally since 2019, and I've never stopped building things of my own on the side.",
      portraitAlt: 'Santtu Nykänen',
      sidebarAria: 'Skills and contact',
      contactTitle: 'Get in touch',
      contactBody: 'The quickest way is email.',
      contactCta: 'Email me',
      skillGroups: [
        { group: 'Languages', items: ['Python', 'TypeScript', 'JavaScript', 'Java', 'GDScript', 'C++', 'Dart', 'SQL'] },
        { group: 'Frameworks', items: ['Django', 'Spring Boot', 'React', 'Vue', 'Node.js', 'Flutter', 'Godot', 'Qt (PySide6)', 'Astro'] },
        { group: 'Data and infra', items: ['PostgreSQL', 'Redis', 'Docker', 'Azure', 'AWS', 'GitHub Actions'] },
        { group: 'Ways of working', items: ['AI agent workflows', 'Code review', 'Test-driven releases', 'Agile', 'Mentoring'] },
      ],
      howIGotHereHeading: 'How I got here',
      howIGotHereP1BeforeScratch:
        'In June 2017 a friend and I signed up for an online programming course on a whim. I read about how much developers were needed, my competitive streak kicked in, and I enrolled in Harvard\'s CS50x. My first project was ',
      howIGotHereScratchLink: 'a basketball game in Scratch',
      howIGotHereP1Middle: '; my final project became the first version of ',
      howIGotHereP1After: '.',
      howIGotHereP2:
        "Nearly two years of self-study later I landed my first developer job in spring 2019. Since then I've worked as a consultant on public and private sector projects, mostly in Python, Java and JavaScript.",
      nowHeading: "What I'm doing now",
      nowBeforeLeash: 'By day I\'m a full-stack consultant at Gofore. In my own time I make and ship whole products: ',
      nowBetweenLeashAndStemma: ', a physics comedy game set in Barcelona; ',
      nowBetweenStemmaAndCoriolis: ', a desktop app for practicing music along with AI-separated stems; and ',
      nowBetweenCoriolisAndHow: ', a 128×128 LED wall. I build them with a crew of AI coding agents, and I\'ve written up ',
      nowHowLink: 'how that works',
      nowAfterHow: '.',
      workHeading: 'Work',
      goforeTitle: 'Gofore · Full-stack developer · 2022 to now',
      goforeBody:
        "Consulting for public and private sector clients at one of Finland's leading digital transformation consultancies. I lead development of features for large government digital services, work closely with designers and product owners, and mentor junior developers. Python (Django), Java (Spring Boot), TypeScript (React, Vue), Docker and Azure.",
      solidabisTitle: 'Solidabis · Full-stack developer · 2019 to 2022',
      solidabisBody:
        'Client projects from healthcare to logistics: full-stack web applications built from the ground up, REST APIs and third-party integrations. React, Node.js, Java, Python and Docker.',
      educationHeading: 'Education',
      educationItems: [
        { school: 'Haaga-Helia University of Applied Sciences', detail: 'BBA in Business Information Technology, 2018 to 2021' },
        { school: 'University of Helsinki', detail: 'Full Stack Open, 2019, and Java Programming MOOC, 2018' },
        { school: 'Harvard University', detail: 'CS50x: Introduction to Computer Science, 2017' },
      ],
      languagesHeading: 'Languages',
      languagesBody: 'Finnish (native), English (fluent), Spanish (basic).',
    },
    howIBuild: {
      title: 'How I build',
      description:
        'How I ship whole products on my own: written briefs, coding agents working in parallel, and a review gate that nothing skips.',
      eyebrow: 'How I build',
      heading: 'I direct, the agents type.',
      lede:
        'I build my projects the way a small studio works. I write the plan and the briefs, coding agents build in parallel, each on its own branch, automated tests and CI gate every merge, and I play and accept every player-facing change. The judgment stays mine; the typing is shared.',
      statsAria: 'Path of Leash Resistance in numbers',
      stats: [
        { value: '1,982', label: 'commits since the first one in July 2026' },
        { value: '467', label: 'pull requests merged' },
        { value: '265', label: 'test files guarding the game' },
        { value: '51', label: 'hand-built walks in and around Barcelona' },
      ],
      statsNote: 'Path of Leash Resistance, as of November 2026.',
      s1Heading: '1. Write it down first',
      s1BodyBeforeP: 'Every project has a ',
      s1BodyMiddle: ' with its design pillars and roadmap, and an ',
      s1BodyAfterA:
        " that any coding agent reads before it touches anything: the tech stack, the conventions, the game's voice, and the rules that are not up for negotiation. When an agent gets something wrong, the fix goes into those files as well as the code, so the next agent doesn't repeat it.",
      s2Heading: '2. One brief per agent, one worktree per brief',
      s2P1:
        'Work goes out in batches. Each piece gets a written brief: a shared preamble with the house rules, a shared brief for that kind of work (say, building a new walk), then the specifics. Each agent works in its own git worktree on its own branch, so a batch of four new walks, or a polish pass across every district of the city, can be built at the same time without anyone stepping on anyone else.',
      s2P2:
        "The briefs carry lessons forward. A batch prompt starts with what earlier batches got wrong: a test that assumed its walk was the last one, poles that all grew street lamps. Those mistakes don't come back.",
      s3Heading: '3. Nothing merges unchecked',
      s3Lead: 'Every pull request has to show its work before it can land:',
      s3ListBeforeCode: [
        "The walk's own tests and the full suite pass, plus a headless smoke run of the game.",
        'A scripted playtest walks the level from start to finish and logs anyone stuck or inside a wall.',
        'Screenshots of every part of the route, in every weather and at night.',
      ],
      s3FeelCardTerm: 'feel card',
      s3FeelCardRest: ': three to five things to try by hand and what should happen. I play them.',
      s3Changelog: 'A changelog entry, checked by a script.',
      s4Heading: '4. Release like a team would',
      s4Body:
        'A version tag builds the web and Windows versions in CI, pushes them to itch.io, and packages the Microsoft Store build. stemma ships the same way, with a pinned release lock so CI tests exactly what users get.',
      s5Heading: 'Why work this way',
      s5Body:
        "The hard part of software was never typing. It's deciding what to build, noticing what's wrong, and keeping a large codebase coherent as it grows. Agents make the typing cheap, which makes those skills matter more, not less. This is how one person ships a game with 51 walks, ten chases and five bosses in a few months, alongside a day job.",
    },
    walkPage: {
      title: 'Walk in 3D · Path of Leash Resistance',
      description:
        'An experiment in how Path of Leash Resistance could look in 3D: walk Millie along the seafront, the beach and the old pier, and through the rail underpass into town.',
      eyebrow: 'Path of Leash Resistance · 3D experiment',
      heading: 'Take Millie into 3D.',
      lede:
        "An experiment in how Path of Leash Resistance could look and feel in 3D. Millie and her human start on the seafront, where the projects have pavilions on the boardwalk. From there, head down to the beach and the old pier, or under the railway into town, where Carrer del Mar's side streets hide favors to do. The leash plays by the real game's rules, and [M] opens the map.",
      creditsPrefix: 'Music: real songs split into stems by stemma, from its demo set.',
      creditBy: 'by',
    },
    notFound: {
      title: 'Page not found',
      eyebrow: '404',
      heading: 'Millie sniffed everywhere. Nothing here.',
      body: 'The page you were after has moved or never existed.',
      cta: 'Back to the map',
    },
    coriolisSim: {
      sectionAria: 'Interactive Coriolis 128 by 128 LED wall emulator',
      badge: 'Live C++11 emulator · 128×128 LED matrix (WebAssembly)',
      heading: 'Try the wall display in your browser',
      quickAria: 'Quick scenes',
      quickScenes: [
        { idx: 0, label: 'Clock' },
        { idx: 1, label: 'Analog' },
        { idx: 16, label: 'Coriolis' },
        { idx: 24, label: 'Aurora' },
        { idx: 23, label: 'Fireplace' },
        { idx: 9, label: 'Yoga' },
        { idx: 10, label: 'Exercise' },
        { idx: 11, label: 'Breathe' },
        { idx: 6, label: 'Snake' },
        { idx: 7, label: 'Tetris' },
        { idx: 8, label: 'Labyrinth' },
      ],
      canvasAria: 'Emulated 128 by 128 LED panel; the current scene and palette are named below it',
      loading: 'Loading emulator…',
      remoteAria: 'Virtual IR remote',
      remoteLabel: 'IR Remote & Controls',
      upAria: 'Up',
      leftAria: 'Left',
      okLabel: 'OK',
      rightAria: 'Right',
      downAria: 'Down',
      launcher: 'Launcher',
      settings: 'Settings',
      clockOverlay: 'Clock overlay',
      back: 'Back',
      nextScene: 'Next scene',
      home: 'Home',
      rotate: 'Rotate 90°',
      nightMode: 'Night mode',
      soundOff: 'Sound off',
      soundOn: 'Sound on',
      fullShowcase: 'Full showcase →',
      hint: 'Click the LED panel or use the remote buttons. Arrows navigate, play Snake/Pong/Tetris/Labyrinth, or switch palettes on ambient scenes.',
      noscriptNote: 'Static preview shown while scripts are disabled. Enable JavaScript for the live 128×128 WebAssembly emulator, or open the standalone showcase.',
    },
    streetMap: {
      ariaLabel:
        'Playable street, with the same controls as Path of Leash Resistance: WASD or arrows move, Shift runs, Space digs in, Q marks a spot, F squats, G picks up, E barks, Tab shows the goals and Enter goes into a shop.',
      defaultCaption: 'Pick a stop.',
      soundOff: 'Sound off',
      soundOn: 'Sound on',
      restart: 'Restart',
      fillWindow: 'Fill window',
      fillWindowTitle: 'Fill the browser window',
      fullscreen: 'Fullscreen',
      fullscreenTitle: 'Real fullscreen',
      controlsAria: 'Controls',
      moreControls: 'All controls',
      stopsAria: 'Stops on the street',
      tryBooth: 'Try',
      closeBooth: 'Close',
      openPage: 'Project page',
      noscriptTitle: 'A walk down Carrer del Mar',
      noscriptNote: 'Scripts are blocked or disabled, so every storefront on the street is linked below. Enable scripts anytime for the playable 2D walk.',
      stops: [
        { id: 'leash', label: 'Path of Leash Resistance', short: 'Leash', kind: 'Game', path: '/projects/path-of-leash-resistance', color: '#ffb020', ink: '#0b1430' },
        { id: 'stemma', label: 'stemma', short: 'stemma', kind: 'Music app', path: '/projects/stemma', color: '#1fc9b7', ink: '#0b1430' },
        { id: 'coriolis', label: 'Coriolis', short: 'Coriolis', kind: 'LED wall', path: '/projects/coriolis', color: '#0b0b0b', ink: '#5eea8c' },
        { id: 'eat-prey-nap', label: 'Eat Prey Nap', short: 'Eat Prey Nap', kind: 'Cat game', path: '/projects/eat-prey-nap', color: '#f0c44d', ink: '#0b1430' },
        { id: 'dopepod', label: 'dopepod', short: 'dopepod', kind: 'Podcasts', path: '/projects/dopepod', color: '#d94ca6', ink: '#f4f1ea' },
        { id: 'blog', label: 'Blog', short: 'Blog', kind: '', path: '/blog', color: '#e5487a', ink: '#0b1430' },
        { id: 'how', label: 'How I build', short: 'How I build', kind: '', path: '/how-i-build', color: '#14203d', ink: '#f4f1ea' },
        { id: 'about', label: 'About', short: 'About', kind: '', path: '/about', color: '#8bcb3c', ink: '#0b1430' },
        { id: 'station', label: 'Estació', short: 'Estació (3D)', kind: 'Train to 3D', path: '/walk?via=train', color: '#e5302a', ink: '#f4f1ea' },
        { id: 'metro', label: 'Metro', short: 'Metro (3D)', kind: 'Metro to 3D', path: '/walk?via=metro', color: '#9b2d8f', ink: '#f4f1ea' },
        { id: 'park', label: 'The park', short: 'Park', kind: 'Off-leash', path: '/walk', color: '#5f9e4a', ink: '#0b1430' },
      ],
      keys: [
        { keys: ['W', 'A', 'S', 'D'], label: 'Move' },
        { keys: ['Shift'], label: 'Run' },
        { keys: ['Space'], label: 'Dig in' },
        { keys: ['Q'], label: 'Mark' },
        { keys: ['F'], label: 'Squat' },
        { keys: ['G'], label: 'Pick up' },
        { keys: ['E'], label: 'Bark' },
        { keys: ['X'], label: 'Try booth' },
        { keys: ['Enter'], label: 'Go in' },
        { keys: ['Tab'], label: 'Goals' },
        { keys: ['R'], label: 'Restart' },
        { keys: ['Esc'], label: 'Leave' },
      ],
    },
    podPlayer: {
      play: 'Play',
      pause: 'Pause',
      prev: 'Previous',
      next: 'Next',
      seek: 'Seek',
      shows: 'Shows',
      openApp: 'Open in dopepod',
      loading: 'Loading',
      buffering: 'Loading…',
      feedFailed: "Couldn't load the podcasts. Try again, or open dopepod.",
      playFailed: "This episode won't play. Try another, or open dopepod.",
      retry: 'Retry',
      idle: 'Ready',
      playing: 'Playing',
      paused: 'Paused',
      error: 'Error',
      hint: 'Real podcasts. Open the booth to listen.',
      banner: 'dopepod: Space play/pause, left/right skip, up/down seek, [X] close',
      prompt: 'Open dopepod',
      toast: 'Real podcasts, straight from their publishers. Pick a show and press play.',
    },
    walk3d: {
      stageAria:
        'Path of Leash Resistance in 3D, in a Catalan seafront town. Click or focus to play: WASD or arrows move, Shift runs, V jumps, Space digs, Q marks, E barks, G picks up, X uses the LED wall or the stemma jukebox, Enter goes into a pavilion, C changes the camera, N skips to the next song, Tab shows the goals. Shift+Tab or Escape leaves the game.',
      clickToPlay: 'Click to play',
      settingsAria: 'Game settings',
      soundOff: 'Sound off',
      soundOn: 'Sound on',
      toolbarMenu: 'Menu',
      nextSong: 'Next song',
      weatherAria: 'Time and weather',
      skyDay: 'Day',
      skyRain: 'Rain',
      skyNight: 'Night',
      camStreet: 'Cam: Street',
      camFollow: 'Cam: Follow',
      camOverhead: 'Cam: Overhead',
      restart: 'Restart',
      screenAria: 'Screen',
      fillWindow: 'Fill window',
      fillWindowTitle: 'Fill the browser window',
      fullscreen: 'Fullscreen',
      fullscreenTitle: 'Real fullscreen',
      stemmaAria: 'stemma jukebox',
      stemmaSub: "Real songs, split into stems by stemma. Pick the street's music.",
      stemmaCloseAria: 'Close the jukebox',
      stemsAria: 'Stems',
      stemVocals: 'Vocals',
      stemDrums: 'Drums',
      stemBass: 'Bass',
      stemOther: 'Other',
      coriolisAria: 'Coriolis LED wall controls',
      coriolisSub: 'Arrows steer, Enter selects, M opens the launcher.',
      coriolisCloseAria: 'Step back from the wall',
      upAria: 'Up',
      leftAria: 'Left',
      okLabel: 'OK',
      rightAria: 'Right',
      downAria: 'Down',
      coriolisLauncher: 'Launcher',
      coriolisSettings: 'Settings',
      coriolisNext: 'Next',
      coriolisBack: 'Back',
      touchAria: 'Touch controls',
      touchJump: 'Jump',
      touchBark: 'Bark',
      touchDig: 'Dig',
      touchMark: 'Mark',
      catAria: 'Eat Prey Nap booth controls',
      catSub: 'Tap the booth screen to pounce, or tune colors & size.',
      catCloseAria: 'Step back from Eat Prey Nap',
      catPalette: 'Palette',
      catSize: 'Mouse',
      catWatch: 'Watch only',
      catPounce: 'Pounce!',
      catCatches: 'Catches',
      podAria: 'dopepod booth controls',
      podSub: 'Real podcasts, straight from their publishers.',
      podCloseAria: 'Close dopepod',
      noscriptTitle: 'The 3D seafront walk requires JavaScript & WebGL',
      noscriptBody: 'Scripts are currently disabled or blocked. You can browse every project page, post, and build guide across the site cleanly without JavaScript.',
      noscriptCtaProjects: 'Browse all projects',
      noscriptCtaHome: 'Back to home',
      controlsAria: 'Controls',
      moreControls: 'All controls',
      keys: [
        { keys: ['W', 'A', 'S', 'D'], label: 'Move' },
        { keys: ['Shift'], label: 'Run' },
        { keys: ['V'], label: 'Jump' },
        { keys: ['Space'], label: 'Dig / dig in' },
        { keys: ['Q'], label: 'Mark' },
        { keys: ['E'], label: 'Bark' },
        { keys: ['G'], label: 'Pick up' },
        { keys: ['X'], label: 'Use' },
        { keys: ['Enter'], label: 'Go in' },
        { keys: ['C'], label: 'Camera' },
        { keys: ['Drag', '[', ']'], label: 'Turn camera' },
        { keys: ['Wheel', '-', '='], label: 'Zoom' },
        { keys: ['Tab'], label: 'Goals' },
        { keys: ['M'], label: 'Map' },
        { keys: ['N'], label: 'Next song' },
        { keys: ['R'], label: 'Restart' },
      ],
    },
  },

  es: {
    site: {
      title: 'Santtu Nykänen',
      defaultTitleSuffix: 'Desarrollador full-stack',
      defaultDescription:
        'Desarrollador full-stack generalista. Web, escritorio, móvil y hardware, construido junto a un equipo de agentes de programación con IA.',
      skipToContent: 'Ir al contenido',
      rssTitle: 'Santtu Nykänen: blog',
      rssDescription: 'Notas sobre desarrollo de juegos, herramientas y hardware, y sobre trabajar con agentes de IA.',
    },
    header: {
      navAria: 'Principal',
      themeToggleAria: 'Cambiar tema de color',
      langSwitcherAria: 'Idioma',
      walkCta: 'Pasea la web',
      nav: {
        projects: 'Proyectos',
        howIBuild: 'Cómo construyo',
        blog: 'Blog',
        about: 'Sobre mí',
      },
    },
    footer: {
      contactAria: 'Contacto',
      email: 'Correo',
      rss: 'RSS',
    },
    kinds: {
      Game: 'Juego',
      'Desktop app': 'App de escritorio',
      Hardware: 'Hardware',
      'Web app': 'App web',
      'Mobile app': 'App móvil',
      Tool: 'Herramienta',
    },
    common: {
      allProjects: 'Todos los proyectos',
      previousProject: 'Proyecto anterior',
      nextProject: 'Proyecto siguiente',
      moreProjectsAria: 'Más proyectos',
      builtWith: 'Tecnologías',
      projectFactsAria: 'Detalles del proyecto',
      allPosts: 'Todos los artículos',
      draftBadge: 'Borrador',
      englishOnlyBadge: 'EN',
      englishFallbackNotice: 'Esta entrada está disponible por ahora solo en inglés.',
      relatedPostsHeading: 'Artículos relacionados',
      projectLabel: 'Proyecto',
      latestRelease: 'Última versión',
      byTheNumbers: 'En cifras',
      factWalks: 'Paseos',
      factBosses: 'Estatuas jefe',
      factCommits: 'Commits',
    },
    home: {
      eyebrow: 'Desarrollador full-stack generalista',
      headline: 'Solo código.',
      lede:
        'Soy Santtu, desarrollador generalista y consultor en Gofore. Llevo años escribiendo software a mano y ahora también construyo con agentes de IA bajo el mismo listón: planificado de antemano, probado y revisado antes de publicar nada. Las pruebas automáticas y CI vigilan las regresiones mientras la jugabilidad se afina probando cada partida, con un resultado tan fiable como cualquier código que haya escrito línea a línea.',
      ctaProjects: 'Ver los proyectos',
      ctaHowIBuild: 'Cómo construyo',
      streetAria: 'Saca a pasear a Millie',
      workTitle: 'Cosas que he hecho',
      allProjectsLink: 'Todos los proyectos',
      howHeading: 'Yo dirijo, los agentes escriben.',
      howBody:
        'Encargos claros, ramas separadas y nada se fusiona sin pasar las pruebas y CI; cada cambio visible para el jugador se juega y acepta antes de entrar. Así es como se construye de golpe toda una tanda de niveles nuevos para Path of Leash Resistance.',
      howCta: 'Cómo funciona',
      steps: [
        { title: 'Encargo', desc: 'Una tarea escrita por agente' },
        { title: 'Lote', desc: 'Worktrees y ramas en paralelo' },
        { title: 'Entrega', desc: 'Revisar, probar, fusionar y publicar' },
      ],
      blogTitle: 'Del blog',
      allPostsLink: 'Todos los artículos',
    },
    projectsIndex: {
      title: 'Proyectos',
      description: 'Juegos, aplicaciones de escritorio, hardware LED y aplicaciones web de Santtu Nykänen.',
      heading: 'Proyectos',
      intro:
        'Las piezas de las que estoy más orgulloso: un juego, una herramienta musical y un mural LED. Más abajo hay proyectos anteriores de cuando estaba aprendiendo el oficio.',
      currentAria: 'Proyectos actuales',
      earlierHeading: 'Trabajos anteriores',
    },
    blogIndex: {
      title: 'Blog',
      description: 'Notas sobre desarrollo de juegos, herramientas y hardware, y sobre trabajar con agentes de IA.',
      heading: 'Blog',
      intro: 'Notas sobre desarrollo de juegos, herramientas y hardware, y sobre trabajar con agentes de IA.',
      subscribeRss: 'Suscribirse por RSS',
      postsAria: 'Artículos',
    },
    about: {
      title: 'Sobre mí',
      description: 'Santtu Nykänen: desarrollador full-stack generalista.',
      eyebrow: 'Sobre mí',
      heading: 'Hola, soy Santtu.',
      lede:
        'Desarrollador full-stack generalista. Llevo escribiendo software de forma profesional desde 2019 y nunca he dejado de construir proyectos propios aparte.',
      portraitAlt: 'Santtu Nykänen',
      sidebarAria: 'Habilidades y contacto',
      contactTitle: 'Contacto',
      contactBody: 'La forma más rápida es por correo.',
      contactCta: 'Escríbeme',
      skillGroups: [
        { group: 'Lenguajes', items: ['Python', 'TypeScript', 'JavaScript', 'Java', 'GDScript', 'C++', 'Dart', 'SQL'] },
        { group: 'Frameworks', items: ['Django', 'Spring Boot', 'React', 'Vue', 'Node.js', 'Flutter', 'Godot', 'Qt (PySide6)', 'Astro'] },
        { group: 'Datos e infraestructura', items: ['PostgreSQL', 'Redis', 'Docker', 'Azure', 'AWS', 'GitHub Actions'] },
        { group: 'Forma de trabajar', items: ['Flujos con agentes de IA', 'Revisión de código', 'Lanzamientos con pruebas', 'Ágil', 'Mentoría'] },
      ],
      howIGotHereHeading: 'Cómo llegué hasta aquí',
      howIGotHereP1BeforeScratch:
        'En junio de 2017 un amigo y yo nos apuntamos por impulso a un curso de programación online. Leí sobre la demanda de desarrolladores, me picó la competitividad y me matriculé en el CS50x de Harvard. Mi primer proyecto fue ',
      howIGotHereScratchLink: 'un juego de baloncesto en Scratch',
      howIGotHereP1Middle: '; mi proyecto final se convirtió en la primera versión de ',
      howIGotHereP1After: '.',
      howIGotHereP2:
        'Casi dos años de estudio por mi cuenta después conseguí mi primer trabajo como desarrollador en la primavera de 2019. Desde entonces he trabajado como consultor en proyectos del sector público y privado, sobre todo con Python, Java y JavaScript.',
      nowHeading: 'En qué estoy ahora',
      nowBeforeLeash: 'De día trabajo como consultor full-stack en Gofore. En mi tiempo libre creo y publico productos completos: ',
      nowBetweenLeashAndStemma: ', una comedia de físicas ambientada en Barcelona; ',
      nowBetweenStemmaAndCoriolis: ', una app de escritorio para practicar música sobre pistas separadas por IA; y ',
      nowBetweenCoriolisAndHow: ', un mural LED de 128×128 píxeles. Los construyo con un equipo de agentes de programación con IA, y he contado ',
      nowHowLink: 'cómo funciona',
      nowAfterHow: '.',
      workHeading: 'Experiencia',
      goforeTitle: 'Gofore · Desarrollador full-stack · 2022 hasta hoy',
      goforeBody:
        'Consultoría para clientes públicos y privados en una de las principales consultoras de transformación digital de Finlandia. Lidero el desarrollo de funcionalidades para grandes servicios digitales públicos, colaboro estrechamente con diseño y producto, y mentorizo a desarrolladores junior. Python (Django), Java (Spring Boot), TypeScript (React, Vue), Docker y Azure.',
      solidabisTitle: 'Solidabis · Desarrollador full-stack · 2019 a 2022',
      solidabisBody:
        'Proyectos para clientes desde sanidad hasta logística: aplicaciones web full-stack creadas desde cero, APIs REST e integraciones con terceros. React, Node.js, Java, Python y Docker.',
      educationHeading: 'Formación',
      educationItems: [
        { school: 'Universidad de Ciencias Aplicadas Haaga-Helia', detail: 'Grado (BBA) en Tecnología de la Información Empresarial, 2018 a 2021' },
        { school: 'Universidad de Helsinki', detail: 'Full Stack Open, 2019, y Java Programming MOOC, 2018' },
        { school: 'Universidad de Harvard', detail: 'CS50x: Introduction to Computer Science, 2017' },
      ],
      languagesHeading: 'Idiomas',
      languagesBody: 'Finés (nativo), inglés (fluido), español (básico).',
    },
    howIBuild: {
      title: 'Cómo construyo',
      description:
        'Cómo publico productos completos por mi cuenta: encargos escritos, agentes trabajando en paralelo y una puerta de revisión que nadie se salta.',
      eyebrow: 'Cómo construyo',
      heading: 'Yo dirijo, los agentes escriben.',
      lede:
        'Construyo mis proyectos como lo haría un pequeño estudio. Yo redacto el plan y los encargos, los agentes programan en paralelo cada uno en su propia rama, las pruebas automáticas y CI filtran cada fusión, y yo juego y acepto cada cambio visible para el jugador. El criterio sigue siendo mío; teclear es trabajo compartido.',
      statsAria: 'Path of Leash Resistance en cifras',
      stats: [
        { value: '1,982', label: 'commits desde el primero en julio de 2026' },
        { value: '467', label: 'pull requests fusionadas' },
        { value: '265', label: 'archivos de pruebas protegiendo el juego' },
        { value: '51', label: 'paseos hechos a mano por Barcelona y alrededores' },
      ],
      statsNote: 'Path of Leash Resistance, a noviembre de 2026.',
      s1Heading: '1. Dejarlo escrito primero',
      s1BodyBeforeP: 'Cada proyecto tiene un ',
      s1BodyMiddle: ' con sus pilares de diseño y hoja de ruta, y un ',
      s1BodyAfterA:
        ' que cualquier agente lee antes de tocar una línea: la arquitectura, las convenciones, el tono del juego y las reglas que no son negociables. Cuando un agente se equivoca en algo, la corrección va tanto a esos documentos como al código para que el siguiente no tropiece en lo mismo.',
      s2Heading: '2. Un encargo por agente, un worktree por encargo',
      s2P1:
        'El trabajo sale en lotes. Cada pieza lleva su encargo escrito: un preámbulo común con las normas de la casa, una guía compartida para ese tipo de tarea (por ejemplo, cómo crear un paseo nuevo) y los detalles concretos. Cada agente trabaja en su propio git worktree y rama, de modo que una tanda de cuatro paseos o un repaso visual por todo un distrito pueden avanzar a la vez sin pisarse.',
      s2P2:
        'Los encargos heredan lo aprendido. El prompt de cada tanda empieza enumerando lo que falló en tandas anteriores: una prueba que asumía que su paseo era el último de la lista, o postes a los que les salían cabezas de farola. Esos errores no vuelven.',
      s3Heading: '3. Nada entra sin revisión',
      s3Lead: 'Cada pull request tiene que demostrar su trabajo antes de fusionarse:',
      s3ListBeforeCode: [
        'Las pruebas propias del paseo y la suite completa en verde, además de una ejecución headless de humo del juego.',
        'Una partida automatizada recorre el nivel de principio a fin y detecta si algún personaje queda atascado o dentro de un muro.',
        'Capturas de pantalla de toda la ruta, en todos los climas y de noche.',
      ],
      s3FeelCardTerm: 'ficha de sensaciones',
      s3FeelCardRest: ': entre tres y cinco cosas que probar a mano y qué debería pasar. Las juego yo.',
      s3Changelog: 'Una entrada de changelog validada por script.',
      s4Heading: '4. Publicar como un equipo',
      s4Body:
        'Una etiqueta de versión compila en CI las versiones web y de Windows, las sube a itch.io y empaqueta la entrega para Microsoft Store. stemma funciona igual, con un bloqueo fijo de dependencias para que CI pruebe exactamente lo mismo que reciben los usuarios.',
      s5Heading: 'Por qué trabajar así',
      s5Body:
        'La parte difícil del software nunca fue teclear. Es decidir qué construir, detectar qué falla y mantener coherente una base de código conforme crece. Los agentes abaratan la escritura de código, y eso hace que ese criterio importe más, no menos. Así es como una sola persona publica un juego con 51 paseos, diez persecuciones y cinco jefes en pocos meses mientras mantiene su trabajo de día.',
    },
    walkPage: {
      title: 'Paseo en 3D · Path of Leash Resistance',
      description:
        'Un experimento sobre cómo podría verse Path of Leash Resistance en 3D: pasea a Millie por el paseo marítimo, la playa y el viejo muelle, y cruza el paso subterráneo hacia el pueblo.',
      eyebrow: 'Path of Leash Resistance · Experimento 3D',
      heading: 'Saca a Millie al 3D.',
      lede:
        'Un experimento sobre cómo podría verse y sentirse Path of Leash Resistance en 3D. Millie y su humano empiezan en el paseo marítimo, donde los proyectos tienen sus pabellones junto a la pasarela. Desde ahí, bajad a la playa y al viejo muelle, o cruzad por debajo de la vía del tren hacia el pueblo, donde las callejuelas de Carrer del Mar esconden favores por hacer. La correa sigue las reglas del juego real y con [M] se abre el mapa.',
      creditsPrefix: 'Música: canciones reales separadas en stems con stemma, de su repertorio de demostración.',
      creditBy: 'de',
    },
    notFound: {
      title: 'Página no encontrada',
      eyebrow: '404',
      heading: 'Millie olfateó por todas partes. Nada por aquí.',
      body: 'La página que buscabas se ha movido o no existía.',
      cta: 'Volver al mapa',
    },
    coriolisSim: {
      sectionAria: 'Emulador interactivo del mural LED Coriolis de 128 por 128',
      badge: 'Emulador C++11 en vivo · matriz LED 128×128 (WebAssembly)',
      heading: 'Prueba la pantalla de pared en tu navegador',
      quickAria: 'Escenas rápidas',
      quickScenes: [
        { idx: 0, label: 'Reloj' },
        { idx: 1, label: 'Analógico' },
        { idx: 16, label: 'Coriolis' },
        { idx: 24, label: 'Aurora' },
        { idx: 23, label: 'Chimenea' },
        { idx: 9, label: 'Yoga' },
        { idx: 10, label: 'Ejercicio' },
        { idx: 11, label: 'Respirar' },
        { idx: 6, label: 'Snake' },
        { idx: 7, label: 'Tetris' },
        { idx: 8, label: 'Laberinto' },
      ],
      canvasAria: 'Panel LED emulado de 128 por 128; la escena y la paleta actuales se muestran debajo',
      loading: 'Cargando emulador…',
      remoteAria: 'Mando IR virtual',
      remoteLabel: 'Mando IR y controles',
      upAria: 'Arriba',
      leftAria: 'Izquierda',
      okLabel: 'OK',
      rightAria: 'Derecha',
      downAria: 'Abajo',
      launcher: 'Lanzador',
      settings: 'Ajustes',
      clockOverlay: 'Reloj flotante',
      back: 'Atrás',
      nextScene: 'Siguiente',
      home: 'Inicio',
      rotate: 'Girar 90°',
      nightMode: 'Modo noche',
      soundOff: 'Sonido no',
      soundOn: 'Sonido sí',
      fullShowcase: 'Web completa →',
      hint: 'Haz clic en el panel LED o usa los botones del mando. Las flechas navegan, juegan a Snake/Pong/Tetris/Laberinto o cambian de paleta en escenas ambientales.',
      noscriptNote: 'Vista previa estática mientras los scripts están desactivados. Activa JavaScript para usar el emulador WebAssembly 128×128 o abre la web del proyecto.',
    },
    streetMap: {
      ariaLabel:
        'Calle jugable con los mismos controles que Path of Leash Resistance: WASD o flechas para mover, Shift para correr, Espacio para plantarse, Q para marcar, F para agacharse, G para recoger, E para ladrar, Tab para ver objetivos y Enter para entrar en un local.',
      defaultCaption: 'Elige una parada.',
      soundOff: 'Sonido no',
      soundOn: 'Sonido sí',
      restart: 'Reiniciar',
      fillWindow: 'Llenar ventana',
      fillWindowTitle: 'Ocupar toda la ventana del navegador',
      fullscreen: 'Pantalla completa',
      fullscreenTitle: 'Pantalla completa real',
      controlsAria: 'Controles',
      moreControls: 'Todos los controles',
      stopsAria: 'Paradas de la calle',
      tryBooth: 'Probar',
      closeBooth: 'Cerrar',
      openPage: 'Ficha',
      noscriptTitle: 'Un paseo por Carrer del Mar',
      noscriptNote: 'Los scripts están bloqueados o desactivados, así que cada local de la calle está enlazado abajo. Activa JavaScript cuando quieras para el paseo jugable en 2D.',
      stops: [
        { id: 'leash', label: 'Path of Leash Resistance', short: 'Leash', kind: 'Juego', path: '/projects/path-of-leash-resistance', color: '#ffb020', ink: '#0b1430' },
        { id: 'stemma', label: 'stemma', short: 'stemma', kind: 'App de música', path: '/projects/stemma', color: '#1fc9b7', ink: '#0b1430' },
        { id: 'coriolis', label: 'Coriolis', short: 'Coriolis', kind: 'Mural LED', path: '/projects/coriolis', color: '#0b0b0b', ink: '#5eea8c' },
        { id: 'eat-prey-nap', label: 'Eat Prey Nap', short: 'Eat Prey Nap', kind: 'Juego gato', path: '/projects/eat-prey-nap', color: '#f0c44d', ink: '#0b1430' },
        { id: 'dopepod', label: 'dopepod', short: 'dopepod', kind: 'Podcasts', path: '/projects/dopepod', color: '#d94ca6', ink: '#f4f1ea' },
        { id: 'blog', label: 'Blog', short: 'Blog', kind: '', path: '/blog', color: '#e5487a', ink: '#0b1430' },
        { id: 'how', label: 'Cómo construyo', short: 'Cómo construyo', kind: '', path: '/how-i-build', color: '#14203d', ink: '#f4f1ea' },
        { id: 'about', label: 'Sobre mí', short: 'Sobre mí', kind: '', path: '/about', color: '#8bcb3c', ink: '#0b1430' },
        { id: 'station', label: 'Estació', short: 'Estació (3D)', kind: 'Tren a 3D', path: '/walk?via=train', color: '#e5302a', ink: '#f4f1ea' },
        { id: 'metro', label: 'Metro', short: 'Metro (3D)', kind: 'Metro a 3D', path: '/walk?via=metro', color: '#9b2d8f', ink: '#f4f1ea' },
        { id: 'park', label: 'El parque', short: 'Parque', kind: 'Sin correa', path: '/walk', color: '#5f9e4a', ink: '#0b1430' },
      ],
      keys: [
        { keys: ['W', 'A', 'S', 'D'], label: 'Mover' },
        { keys: ['Shift'], label: 'Correr' },
        { keys: ['Space'], label: 'Plantarse' },
        { keys: ['Q'], label: 'Marcar' },
        { keys: ['F'], label: 'Agacharse' },
        { keys: ['G'], label: 'Recoger' },
        { keys: ['E'], label: 'Ladrar' },
        { keys: ['X'], label: 'Probar local' },
        { keys: ['Enter'], label: 'Entrar' },
        { keys: ['Tab'], label: 'Objetivos' },
        { keys: ['R'], label: 'Reiniciar' },
        { keys: ['Esc'], label: 'Salir' },
      ],
    },
    podPlayer: {
      play: 'Reproducir',
      pause: 'Pausa',
      prev: 'Anterior',
      next: 'Siguiente',
      seek: 'Posición',
      shows: 'Podcasts',
      openApp: 'Abrir en dopepod',
      loading: 'Cargando',
      buffering: 'Cargando…',
      feedFailed: 'No se han podido cargar los podcasts. Reinténtalo o abre dopepod.',
      playFailed: 'Este episodio no se puede reproducir. Prueba otro o abre dopepod.',
      retry: 'Reintentar',
      idle: 'Listo',
      playing: 'Sonando',
      paused: 'En pausa',
      error: 'Error',
      hint: 'Podcasts reales. Abre la caseta para escuchar.',
      banner: 'dopepod: espacio reproducir/pausa, izquierda/derecha saltar, arriba/abajo avanzar, [X] cerrar',
      prompt: 'Abrir dopepod',
      toast: 'Podcasts reales, directos de quien los publica. Elige uno y dale a reproducir.',
    },
    walk3d: {
      stageAria:
        'Path of Leash Resistance en 3D, en un pueblo costero catalán. Haz clic para jugar: WASD o flechas para mover, Shift para correr, V para saltar, Espacio para cavar, Q para marcar, E para ladrar, G para recoger, X para usar el mural LED o la gramola stemma, Enter para entrar en un pabellón, C para cambiar de cámara, N para pasar de canción y Tab para ver objetivos. Shift+Tab o Escape salen del juego.',
      clickToPlay: 'Haz clic para jugar',
      settingsAria: 'Ajustes del juego',
      soundOff: 'Sonido no',
      soundOn: 'Sonido sí',
      toolbarMenu: 'Menú',
      nextSong: 'Siguiente canción',
      weatherAria: 'Hora y clima',
      skyDay: 'Día',
      skyRain: 'Lluvia',
      skyNight: 'Noche',
      camStreet: 'Cám: Calle',
      camFollow: 'Cám: Seguir',
      camOverhead: 'Cám: Cenital',
      restart: 'Reiniciar',
      screenAria: 'Pantalla',
      fillWindow: 'Llenar ventana',
      fillWindowTitle: 'Ocupar toda la ventana del navegador',
      fullscreen: 'Pantalla completa',
      fullscreenTitle: 'Pantalla completa real',
      stemmaAria: 'Gramola stemma',
      stemmaSub: 'Canciones reales separadas en stems con stemma. Elige la música del paseo.',
      stemmaCloseAria: 'Cerrar la gramola',
      stemsAria: 'Stems',
      stemVocals: 'Voz',
      stemDrums: 'Batería',
      stemBass: 'Bajo',
      stemOther: 'Otros',
      coriolisAria: 'Controles del mural LED Coriolis',
      coriolisSub: 'Las flechas mueven, Enter selecciona y M abre el lanzador.',
      coriolisCloseAria: 'Apartarse del mural',
      upAria: 'Arriba',
      leftAria: 'Izquierda',
      okLabel: 'OK',
      rightAria: 'Derecha',
      downAria: 'Abajo',
      coriolisLauncher: 'Lanzador',
      coriolisSettings: 'Ajustes',
      coriolisNext: 'Siguiente',
      coriolisBack: 'Atrás',
      touchAria: 'Controles táctiles',
      touchJump: 'Saltar',
      touchBark: 'Ladrar',
      touchDig: 'Cavar',
      touchMark: 'Marcar',
      catAria: 'Controles de Eat Prey Nap',
      catSub: 'Toca la pantalla para saltar o ajusta colores y tamaño.',
      catCloseAria: 'Apartarse de Eat Prey Nap',
      catPalette: 'Paleta',
      catSize: 'Ratón',
      catWatch: 'Solo mirar',
      catPounce: 'Saltar',
      catCatches: 'Capturas',
      podAria: 'Controles de dopepod',
      podSub: 'Podcasts reales, directos de quien los publica.',
      podCloseAria: 'Cerrar dopepod',
      noscriptTitle: 'El paseo 3D necesita JavaScript y WebGL',
      noscriptBody: 'Los scripts están desactivados o bloqueados. Puedes explorar igualmente todos los proyectos, artículos y guías técnicas sin JavaScript.',
      noscriptCtaProjects: 'Ver proyectos',
      noscriptCtaHome: 'Volver al inicio',
      controlsAria: 'Controles',
      moreControls: 'Todos los controles',
      keys: [
        { keys: ['W', 'A', 'S', 'D'], label: 'Mover' },
        { keys: ['Shift'], label: 'Correr' },
        { keys: ['V'], label: 'Saltar' },
        { keys: ['Space'], label: 'Cavar / plantar' },
        { keys: ['Q'], label: 'Marcar' },
        { keys: ['E'], label: 'Ladrar' },
        { keys: ['G'], label: 'Recoger' },
        { keys: ['X'], label: 'Usar' },
        { keys: ['Enter'], label: 'Entrar' },
        { keys: ['C'], label: 'Cámara' },
        { keys: ['Drag', '[', ']'], label: 'Girar cámara' },
        { keys: ['Wheel', '-', '='], label: 'Zoom' },
        { keys: ['Tab'], label: 'Objetivos' },
        { keys: ['M'], label: 'Mapa' },
        { keys: ['N'], label: 'Otra canción' },
        { keys: ['R'], label: 'Reiniciar' },
      ],
    },
  },

  ca: {
    site: {
      title: 'Santtu Nykänen',
      defaultTitleSuffix: 'Desenvolupador full-stack',
      defaultDescription:
        "Desenvolupador full-stack generalista. Web, escriptori, mòbil i maquinari, construït amb un equip d'agents de programació amb IA.",
      skipToContent: 'Vés al contingut',
      rssTitle: 'Santtu Nykänen: blog',
      rssDescription: "Notes sobre desenvolupament de jocs, eines i maquinari, i sobre treballar amb agents d'IA.",
    },
    header: {
      navAria: 'Principal',
      themeToggleAria: 'Canvia el tema de color',
      langSwitcherAria: 'Idioma',
      walkCta: 'Passeja el web',
      nav: {
        projects: 'Projectes',
        howIBuild: 'Com construeixo',
        blog: 'Blog',
        about: 'Sobre mi',
      },
    },
    footer: {
      contactAria: 'Contacte',
      email: 'Correu',
      rss: 'RSS',
    },
    kinds: {
      Game: 'Joc',
      'Desktop app': "App d'escriptori",
      Hardware: 'Maquinari',
      'Web app': 'App web',
      'Mobile app': 'App mòbil',
      Tool: 'Eina',
    },
    common: {
      allProjects: 'Tots els projectes',
      previousProject: 'Projecte anterior',
      nextProject: 'Projecte següent',
      moreProjectsAria: 'Més projectes',
      builtWith: 'Tecnologies',
      projectFactsAria: 'Detalls del projecte',
      allPosts: 'Tots els articles',
      draftBadge: 'Esborrany',
      englishOnlyBadge: 'EN',
      englishFallbackNotice: 'Aquesta entrada està disponible ara mateix només en anglès.',
      relatedPostsHeading: 'Articles relacionats',
      projectLabel: 'Projecte',
      latestRelease: 'Última versió',
      byTheNumbers: 'En xifres',
      factWalks: 'Passeigs',
      factBosses: 'Estàtues cap',
      factCommits: 'Commits',
    },
    home: {
      eyebrow: 'Desenvolupador full-stack generalista',
      headline: 'Només codi.',
      lede:
        "Soc en Santtu, desenvolupador generalista i consultor a Gofore. Fa anys que escric programari a mà i ara també construeixo amb agents d'IA sota el mateix llistó: planificat per endavant, provat i revisat abans de publicar res. Les proves automàtiques i CI vigilen les regressions mentre el tacte s'afina jugant-hi, amb un resultat tan fiable com qualsevol codi que hagi escrit línia per línia.",
      ctaProjects: 'Veure els projectes',
      ctaHowIBuild: 'Com construeixo',
      streetAria: 'Treu la Millie a passejar',
      workTitle: 'Coses que he fet',
      allProjectsLink: 'Tots els projectes',
      howHeading: 'Jo dirigeixo, els agents escriuen.',
      howBody:
        "Encàrrecs clars, branques separades i res no s'integra sense passar les proves i CI; cada canvi visible per al jugador es juga i s'accepta abans d'entrar. Així és com es construeix de cop tota una tanda de nivells nous per a Path of Leash Resistance.",
      howCta: 'Com funciona',
      steps: [
        { title: 'Encàrrec', desc: 'Una tasca escrita per agent' },
        { title: 'Lot', desc: 'Worktrees i branques en paral·lel' },
        { title: 'Lliurament', desc: 'Revisar, jugar, fusionar i publicar' },
      ],
      blogTitle: 'Del blog',
      allPostsLink: 'Tots els articles',
    },
    projectsIndex: {
      title: 'Projectes',
      description: "Jocs, aplicacions d'escriptori, maquinari LED i aplicacions web de Santtu Nykänen.",
      heading: 'Projectes',
      intro:
        "Les peces de què estic més orgullós: un joc, una eina musical i un mural LED. Més avall hi ha projectes anteriors de quan estava aprenent l'ofici.",
      currentAria: 'Projectes actuals',
      earlierHeading: 'Treballs anteriors',
    },
    blogIndex: {
      title: 'Blog',
      description: "Notes sobre desenvolupament de jocs, eines i maquinari, i sobre treballar amb agents d'IA.",
      heading: 'Blog',
      intro: "Notes sobre desenvolupament de jocs, eines i maquinari, i sobre treballar amb agents d'IA.",
      subscribeRss: 'Subscriu-te per RSS',
      postsAria: 'Articles',
    },
    about: {
      title: 'Sobre mi',
      description: 'Santtu Nykänen: desenvolupador full-stack generalista.',
      eyebrow: 'Sobre mi',
      heading: 'Hola, soc en Santtu.',
      lede:
        'Desenvolupador full-stack generalista. Faig programari professionalment des del 2019 i no he deixat mai de construir projectes propis pel meu compte.',
      portraitAlt: 'Santtu Nykänen',
      sidebarAria: 'Habilitats i contacte',
      contactTitle: 'Contacte',
      contactBody: 'La manera més ràpida és per correu.',
      contactCta: 'Escriu-me',
      skillGroups: [
        { group: 'Llenguatges', items: ['Python', 'TypeScript', 'JavaScript', 'Java', 'GDScript', 'C++', 'Dart', 'SQL'] },
        { group: 'Frameworks', items: ['Django', 'Spring Boot', 'React', 'Vue', 'Node.js', 'Flutter', 'Godot', 'Qt (PySide6)', 'Astro'] },
        { group: 'Dades i infraestructura', items: ['PostgreSQL', 'Redis', 'Docker', 'Azure', 'AWS', 'GitHub Actions'] },
        { group: 'Manera de treballar', items: ["Fluxos amb agents d'IA", 'Revisió de codi', 'Llançaments amb proves', 'Àgil', 'Mentoria'] },
      ],
      howIGotHereHeading: 'Com vaig arribar fins aquí',
      howIGotHereP1BeforeScratch:
        'El juny del 2017 un amic i jo ens vam apuntar per impuls a un curs de programació en línia. Vaig llegir sobre la demanda de desenvolupadors, se’m va despertar l’esperit competitiu i em vaig matricular al CS50x de Harvard. El meu primer projecte va ser ',
      howIGotHereScratchLink: 'un joc de bàsquet en Scratch',
      howIGotHereP1Middle: '; el meu projecte final es va convertir en la primera versió de ',
      howIGotHereP1After: '.',
      howIGotHereP2:
        'Gairebé dos anys d’estudi autodidacta després vaig aconseguir la meva primera feina de desenvolupador la primavera del 2019. Des d’aleshores he treballat com a consultor en projectes del sector públic i privat, sobretot amb Python, Java i JavaScript.',
      nowHeading: 'Què estic fent ara',
      nowBeforeLeash: 'De dia treballo com a consultor full-stack a Gofore. En el meu temps lliure faig i publico productes complets: ',
      nowBetweenLeashAndStemma: ', una comèdia de físiques ambientada a Barcelona; ',
      nowBetweenStemmaAndCoriolis: ", una app d'escriptori per practicar música damunt de pistes separades amb IA; i ",
      nowBetweenCoriolisAndHow: ", un mural LED de 128×128 píxels. Els construeixo amb un equip d'agents de programació amb IA, i n'he explicat ",
      nowHowLink: 'com funciona',
      nowAfterHow: '.',
      workHeading: 'Experiència',
      goforeTitle: 'Gofore · Desenvolupador full-stack · 2022 fins avui',
      goforeBody:
        "Consultoria per a clients públics i privats en una de les principals consultores de transformació digital de Finlàndia. Lidero el desenvolupament de funcionalitats per a grans serveis digitals públics, treballo colze a colze amb disseny i producte, i mentorizo desenvolupadors júnior. Python (Django), Java (Spring Boot), TypeScript (React, Vue), Docker i Azure.",
      solidabisTitle: 'Solidabis · Desenvolupador full-stack · 2019 a 2022',
      solidabisBody:
        'Projectes per a clients des de sanitat fins a logística: aplicacions web full-stack construïdes des de zero, APIs REST i integracions amb tercers. React, Node.js, Java, Python i Docker.',
      educationHeading: 'Formació',
      educationItems: [
        { school: 'Universitat de Ciències Aplicades Haaga-Helia', detail: 'Grau (BBA) en Tecnologia de la Informació Empresarial, 2018 a 2021' },
        { school: "Universitat d'Hèlsinki", detail: 'Full Stack Open, 2019, i Java Programming MOOC, 2018' },
        { school: 'Universitat de Harvard', detail: 'CS50x: Introduction to Computer Science, 2017' },
      ],
      languagesHeading: 'Idiomes',
      languagesBody: 'Finès (nadiu), anglès (fluid), espanyol (bàsic).',
    },
    howIBuild: {
      title: 'Com construeixo',
      description:
        "Com publico productes complets pel meu compte: encàrrecs escrits, agents treballant en paral·lel i una porta de revisió que ningú se salta.",
      eyebrow: 'Com construeixo',
      heading: 'Jo dirigeixo, els agents escriuen.',
      lede:
        "Construeixo els meus projectes com ho faria un petit estudi. Jo redacto el pla i els encàrrecs, els agents programen en paral·lel cadascú en la seva branca, les proves automàtiques i CI filtren cada fusió, i jo jugo i accepto cada canvi visible per al jugador. El criteri continua sent meu; picar codi és feina compartida.",
      statsAria: 'Path of Leash Resistance en xifres',
      stats: [
        { value: '1,982', label: 'commits des del primer el juliol de 2026' },
        { value: '467', label: 'pull requests fusionades' },
        { value: '265', label: 'fitxers de proves protegint el joc' },
        { value: '51', label: 'passeigs fets a mà per Barcelona i rodalies' },
      ],
      statsNote: 'Path of Leash Resistance, a novembre de 2026.',
      s1Heading: '1. Deixar-ho escrit primer',
      s1BodyBeforeP: 'Cada projecte té un ',
      s1BodyMiddle: ' amb els seus pilars de disseny i full de ruta, i un ',
      s1BodyAfterA:
        ' que qualsevol agent llegeix abans de tocar una línia: l’stack, les convencions, la veu del joc i les regles que no són negociables. Quan un agent s’equivoca en alguna cosa, la correcció va tant a aquests fitxers com al codi perquè el següent no hi torni a caure.',
      s2Heading: '2. Un encàrrec per agent, un worktree per encàrrec',
      s2P1:
        "La feina surt en lots. Cada peça té un encàrrec escrit: un preàmbul comú amb les normes de la casa, un encàrrec compartit per a aquella mena de feina (per exemple, fer un passeig nou) i els detalls concrets. Cada agent treballa al seu propi git worktree i branca, així que una tanda de quatre passeigs o un repàs per tot un districte poden avançar alhora sense trepitjar-se.",
      s2P2:
        'Els encàrrecs arrosseguen les lliçons apreses. Un prompt de lot comença amb allò que els lots anteriors van fer malament: un test que assumia que el seu passeig era l’últim de la llista, o pals als quals els sortien fanals al capdamunt. Aquestes errades no tornen.',
      s3Heading: '3. Res no entra sense revisió',
      s3Lead: 'Cada pull request ha de demostrar la feina feta abans d’aterrar:',
      s3ListBeforeCode: [
        'Les proves pròpies del passeig i tota la suite en verd, més una execució headless de fum del joc.',
        'Una partida automatitzada recorre el nivell de cap a cap i detecta si algú queda encallat o dins d’una paret.',
        'Captures de pantalla de tota la ruta, amb tots els climes i de nit.',
      ],
      s3FeelCardTerm: 'fitxa de sensacions',
      s3FeelCardRest: ': de tres a cinc coses per provar a mà i què hauria de passar. Les jugo jo.',
      s3Changelog: 'Una entrada de changelog comprovada per script.',
      s4Heading: '4. Publicar com un equip',
      s4Body:
        "Una etiqueta de versió compila a CI les versions web i Windows, les puja a itch.io i empaqueta la versió de Microsoft Store. stemma funciona igual, amb un bloqueig fix de dependències perquè CI provi exactament allò que reben els usuaris.",
      s5Heading: 'Per què treballar així',
      s5Body:
        "La part difícil del programari no va ser mai teclejar. És decidir què construir, adonar-se del que falla i mantenir coherent una base de codi a mesura que creix. Els agents fan barat escriure codi, i això fa que aquest criteri importi més, no menys. Així és com una sola persona publica un joc amb 51 passeigs, deu persecucions i cinc caps finals en pocs mesos tot compaginant-ho amb la feina diària.",
    },
    walkPage: {
      title: 'Passeig en 3D · Path of Leash Resistance',
      description:
        'Un experiment sobre com podria veure’s Path of Leash Resistance en 3D: passeja la Millie pel passeig marítim, la platja i el vell moll, i travessa el pas soterrani cap al poble.',
      eyebrow: 'Path of Leash Resistance · Experiment 3D',
      heading: 'Treu la Millie al 3D.',
      lede:
        'Un experiment sobre com podria veure’s i sentir-se Path of Leash Resistance en 3D. La Millie i el seu humà comencen al passeig marítim, on els projectes tenen pavellons arran de passarel·la. Des d’allà, baixeu fins a la platja i el vell moll, o passeu per sota de la via cap al poble, on els carrerons del Carrer del Mar amaguen favors per fer. La corretja segueix les regles del joc real i amb [M] s’obre el mapa.',
      creditsPrefix: 'Música: cançons reals separades en stems amb stemma, del seu repertori de demostració.',
      creditBy: 'de',
    },
    notFound: {
      title: 'Pàgina no trobada',
      eyebrow: '404',
      heading: 'La Millie ha ensumat per tot arreu. Res per aquí.',
      body: "La pàgina que buscaves s'ha mogut o no ha existit mai.",
      cta: 'Torna al mapa',
    },
    coriolisSim: {
      sectionAria: 'Emulador interactiu del mural LED Coriolis de 128 per 128',
      badge: 'Emulador C++11 en directe · matriu LED 128×128 (WebAssembly)',
      heading: 'Prova la pantalla de paret al navegador',
      quickAria: 'Escenes ràpides',
      quickScenes: [
        { idx: 0, label: 'Rellotge' },
        { idx: 1, label: 'Analògic' },
        { idx: 16, label: 'Coriolis' },
        { idx: 24, label: 'Aurora' },
        { idx: 23, label: 'Llar de foc' },
        { idx: 9, label: 'Ioga' },
        { idx: 10, label: 'Exercici' },
        { idx: 11, label: 'Respirar' },
        { idx: 6, label: 'Snake' },
        { idx: 7, label: 'Tetris' },
        { idx: 8, label: 'Laberint' },
      ],
      canvasAria: "Panell LED emulat de 128 per 128; l'escena i la paleta actuals surten a sota",
      loading: "Carregant l'emulador…",
      remoteAria: 'Comandament IR virtual',
      remoteLabel: 'Comandament IR i controls',
      upAria: 'Amunt',
      leftAria: 'Esquerra',
      okLabel: 'OK',
      rightAria: 'Dreta',
      downAria: 'Avall',
      launcher: 'Llançador',
      settings: 'Ajustos',
      clockOverlay: 'Rellotge flotant',
      back: 'Enrere',
      nextScene: 'Següent',
      home: 'Inici',
      rotate: 'Gira 90°',
      nightMode: 'Mode nit',
      soundOff: 'So no',
      soundOn: 'So sí',
      fullShowcase: 'Web completa →',
      hint: 'Fes clic al panell LED o fes servir els botons del comandament. Les fletxes naveguen, juguen a Snake/Pong/Tetris/Laberint o canvien la paleta a les escenes ambientals.',
      noscriptNote: 'Previsualització estàtica mentre els scripts estan desactivats. Activa JavaScript per a l’emulador WebAssembly 128×128 o obre el web del projecte.',
    },
    streetMap: {
      ariaLabel:
        'Carrer jugable amb els mateixos controls que Path of Leash Resistance: WASD o fletxes per moure, Shift per córrer, Espai per plantar-se, Q per marcar, F per ajupir-se, G per recollir, E per bordar, Tab per veure objectius i Enter per entrar en un local.',
      defaultCaption: 'Tria una parada.',
      soundOff: 'So no',
      soundOn: 'So sí',
      restart: 'Reinicia',
      fillWindow: 'Omple finestra',
      fillWindowTitle: 'Omplir tota la finestra del navegador',
      fullscreen: 'Pantalla completa',
      fullscreenTitle: 'Pantalla completa real',
      controlsAria: 'Controls',
      moreControls: 'Tots els controls',
      stopsAria: 'Parades del carrer',
      tryBooth: 'Prova',
      closeBooth: 'Tanca',
      openPage: 'Fitxa',
      noscriptTitle: 'Un passeig per Carrer del Mar',
      noscriptNote: 'Els scripts estan blocats o desactivats; cada local del carrer té el seu enllaç a sota. Activa JavaScript quan vulguis per al passeig jugable en 2D.',
      stops: [
        { id: 'leash', label: 'Path of Leash Resistance', short: 'Leash', kind: 'Joc', path: '/projects/path-of-leash-resistance', color: '#ffb020', ink: '#0b1430' },
        { id: 'stemma', label: 'stemma', short: 'stemma', kind: 'App de música', path: '/projects/stemma', color: '#1fc9b7', ink: '#0b1430' },
        { id: 'coriolis', label: 'Coriolis', short: 'Coriolis', kind: 'Mural LED', path: '/projects/coriolis', color: '#0b0b0b', ink: '#5eea8c' },
        { id: 'eat-prey-nap', label: 'Eat Prey Nap', short: 'Eat Prey Nap', kind: 'Joc de gat', path: '/projects/eat-prey-nap', color: '#f0c44d', ink: '#0b1430' },
        { id: 'dopepod', label: 'dopepod', short: 'dopepod', kind: 'Podcasts', path: '/projects/dopepod', color: '#d94ca6', ink: '#f4f1ea' },
        { id: 'blog', label: 'Blog', short: 'Blog', kind: '', path: '/blog', color: '#e5487a', ink: '#0b1430' },
        { id: 'how', label: 'Com construeixo', short: 'Com construeixo', kind: '', path: '/how-i-build', color: '#14203d', ink: '#f4f1ea' },
        { id: 'about', label: 'Sobre mi', short: 'Sobre mi', kind: '', path: '/about', color: '#8bcb3c', ink: '#0b1430' },
        { id: 'station', label: 'Estació', short: 'Estació (3D)', kind: 'Tren a 3D', path: '/walk?via=train', color: '#e5302a', ink: '#f4f1ea' },
        { id: 'metro', label: 'Metro', short: 'Metro (3D)', kind: 'Metro a 3D', path: '/walk?via=metro', color: '#9b2d8f', ink: '#f4f1ea' },
        { id: 'park', label: 'El parc', short: 'Parc', kind: 'Sense corretja', path: '/walk', color: '#5f9e4a', ink: '#0b1430' },
      ],
      keys: [
        { keys: ['W', 'A', 'S', 'D'], label: 'Mou-te' },
        { keys: ['Shift'], label: 'Corre' },
        { keys: ['Space'], label: 'Planta’t' },
        { keys: ['Q'], label: 'Marca' },
        { keys: ['F'], label: 'Ajup-te' },
        { keys: ['G'], label: 'Recull' },
        { keys: ['E'], label: 'Borda' },
        { keys: ['X'], label: 'Prova parada' },
        { keys: ['Enter'], label: 'Entra' },
        { keys: ['Tab'], label: 'Objectius' },
        { keys: ['R'], label: 'Reinicia' },
        { keys: ['Esc'], label: 'Surt' },
      ],
    },
    podPlayer: {
      play: 'Reprodueix',
      pause: 'Pausa',
      prev: 'Anterior',
      next: 'Següent',
      seek: 'Posició',
      shows: 'Pòdcasts',
      openApp: 'Obre a dopepod',
      loading: 'Carregant',
      buffering: 'Carregant…',
      feedFailed: "No s'han pogut carregar els pòdcasts. Torna-ho a provar o obre dopepod.",
      playFailed: "Aquest episodi no es pot reproduir. Prova'n un altre o obre dopepod.",
      retry: 'Reintenta',
      idle: 'A punt',
      playing: 'Sonant',
      paused: 'En pausa',
      error: 'Error',
      hint: 'Pòdcasts reals. Obre la caseta per escoltar.',
      banner: 'dopepod: espai reprodueix/pausa, esquerra/dreta salta, amunt/avall avança, [X] tanca',
      prompt: 'Obre dopepod',
      toast: 'Pòdcasts reals, directes de qui els publica. Tria’n un i prem reprodueix.',
    },
    walk3d: {
      stageAria:
        'Path of Leash Resistance en 3D, en un poble costaner català. Fes clic per jugar: WASD o fletxes per moure, Shift per córrer, V per saltar, Espai per cavar, Q per marcar, E per bordar, G per recollir, X per fer servir el mural LED o la gramola stemma, Enter per entrar en un pavelló, C per canviar de càmera, N per passar de cançó i Tab per veure objectius. Shift+Tab o Escape surten del joc.',
      clickToPlay: 'Fes clic per jugar',
      settingsAria: 'Ajustos del joc',
      soundOff: 'So no',
      soundOn: 'So sí',
      toolbarMenu: 'Menú',
      nextSong: 'Cançó següent',
      weatherAria: 'Hora i temps',
      skyDay: 'Dia',
      skyRain: 'Pluja',
      skyNight: 'Nit',
      camStreet: 'Càm: Carrer',
      camFollow: 'Càm: Seguir',
      camOverhead: 'Càm: Zenital',
      restart: 'Reinicia',
      screenAria: 'Pantalla',
      fillWindow: 'Omple finestra',
      fillWindowTitle: 'Omplir tota la finestra del navegador',
      fullscreen: 'Pantalla completa',
      fullscreenTitle: 'Pantalla completa real',
      stemmaAria: 'Gramola stemma',
      stemmaSub: 'Cançons reals separades en stems amb stemma. Tria la música del passeig.',
      stemmaCloseAria: 'Tanca la gramola',
      stemsAria: 'Stems',
      stemVocals: 'Veu',
      stemDrums: 'Bateria',
      stemBass: 'Baix',
      stemOther: 'Altres',
      coriolisAria: 'Controls del mural LED Coriolis',
      coriolisSub: 'Les fletxes mouen, Enter selecciona i M obre el llançador.',
      coriolisCloseAria: 'Aparta’t del mural',
      upAria: 'Amunt',
      leftAria: 'Esquerra',
      okLabel: 'OK',
      rightAria: 'Dreta',
      downAria: 'Avall',
      coriolisLauncher: 'Llançador',
      coriolisSettings: 'Ajustos',
      coriolisNext: 'Següent',
      coriolisBack: 'Enrere',
      touchAria: 'Controls tàctils',
      touchJump: 'Salta',
      touchBark: 'Borda',
      touchDig: 'Cava',
      touchMark: 'Marca',
      catAria: 'Controls d’Eat Prey Nap',
      catSub: 'Toca la pantalla per saltar o ajusta colors i mida.',
      catCloseAria: 'Aparta’t d’Eat Prey Nap',
      catPalette: 'Paleta',
      catSize: 'Ratolí',
      catWatch: 'Només mirar',
      catPounce: 'Salta!',
      catCatches: 'Captures',
      podAria: 'Controls de dopepod',
      podSub: 'Pòdcasts reals, directes de qui els publica.',
      podCloseAria: 'Tanca dopepod',
      noscriptTitle: 'El passeig 3D necessita JavaScript i WebGL',
      noscriptBody: 'Els scripts estan desactivats o blocats. Pots llegir igualment tots els projectes, articles i guies tècniques sense JavaScript.',
      noscriptCtaProjects: 'Mostra els projectes',
      noscriptCtaHome: 'Torna a l’inici',
      controlsAria: 'Controls',
      moreControls: 'Tots els controls',
      keys: [
        { keys: ['W', 'A', 'S', 'D'], label: 'Mou-te' },
        { keys: ['Shift'], label: 'Corre' },
        { keys: ['V'], label: 'Salta' },
        { keys: ['Space'], label: 'Cava / planta’t' },
        { keys: ['Q'], label: 'Marca' },
        { keys: ['E'], label: 'Borda' },
        { keys: ['G'], label: 'Recull' },
        { keys: ['X'], label: 'Fes servir' },
        { keys: ['Enter'], label: 'Entra' },
        { keys: ['C'], label: 'Càmera' },
        { keys: ['Drag', '[', ']'], label: 'Gira càmera' },
        { keys: ['Wheel', '-', '='], label: 'Zoom' },
        { keys: ['Tab'], label: 'Objectius' },
        { keys: ['M'], label: 'Mapa' },
        { keys: ['N'], label: 'Altra cançó' },
        { keys: ['R'], label: 'Reinicia' },
      ],
    },
  },
};

export function getUi(locale: Locale): UiDictionary {
  return UI[locale];
}

export function tKind(locale: Locale, kind: string): string {
  const dict = UI[locale].kinds;
  return (dict as Record<string, string>)[kind] ?? kind;
}
