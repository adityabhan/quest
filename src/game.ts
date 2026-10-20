import Phaser from 'phaser';
import sammyAvatarUrl from '../assets/sammy-smile.jpg';
import adityaAvatarUrl from '../assets/aditya.jpg';
import pindLogoUrl from '../assets/pind-balluchi.png';
import mosquitoSoundUrl from '../assets/Mosquito Sound Effect.mp3';
import birdsSoundUrl from '../assets/birds.mp3';
import finaleSongUrl from '../assets/jab-we-met-cut.mp3';
import { objectives, interactions } from './content';
import { freshProgress, loadProgress, resetProgress, saveProgress, type MissionState, type Step } from './progress';

type Point = { x: number; y: number; id: string; label: string };

export class GameController {
  private state: MissionState = loadProgress() ?? freshProgress();
  private scene!: AdventureScene;
  private paused = false;
  private strictInteractions = import.meta.env.VITE_STRICT_INTERACTIONS === 'true';
  private modal = document.querySelector<HTMLDivElement>('#modal-root')!;
  private objective = document.querySelector<HTMLParagraphElement>('#objective')!;
  private interactButton = document.querySelector<HTMLButtonElement>('#interact-button')!;
  constructor() {
    new Phaser.Game({ type: Phaser.AUTO, parent: 'game', backgroundColor: '#201d3d', scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: 390, height: 700 }, scene: [AdventureScene], render: { pixelArt: true, antialias: false } });
    document.querySelector('#journal-button')?.addEventListener('click', () => this.openJournal());
    document.querySelector('#pause-button')?.addEventListener('click', () => this.togglePause());
    document.querySelector('#interact-button')?.addEventListener('click', () => this.scene.interact());
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-move]'))) {
      const direction = button.dataset.move === 'left' ? -1 : 1;
      button.addEventListener('pointerdown', () => this.scene.setMove(direction));
      button.addEventListener('pointerup', () => this.scene.setMove(0));
      button.addEventListener('pointerleave', () => this.scene.setMove(0));
    }
  }
  attach(scene: AdventureScene) { this.scene = scene; this.refresh(); if (!loadProgress()) this.openTitle(); else this.openTitle(true); }
  getState() { return this.state; }
  isStrictInteractionMode() { return this.strictInteractions; }
  setInteractionAvailable(available: boolean) { if (!this.strictInteractions) { this.interactButton.disabled = false; this.interactButton.classList.remove('unavailable'); return; } this.interactButton.disabled = !available; this.interactButton.classList.toggle('unavailable', !available); }
  advance(step: Step, change: Partial<MissionState> = {}) { this.state = { ...this.state, ...change, step }; saveProgress(this.state); this.refresh(); this.scene.drawWorld(); }
  refresh() { this.objective.textContent = objectives[this.state.step]; }
  showMessage(title: string, text: string, next?: () => void) { this.modal.innerHTML = `<div class="modal"><article class="card"><h2>${title}</h2><p>${text}</p><button id="continue">Continue</button></article></div>`; this.modal.querySelector('#continue')?.addEventListener('click', () => { this.modal.innerHTML = ''; next?.(); }); }
  openTitle(resume = false) {
    const label = resume ? 'Resume adventure' : 'Begin adventure';
    this.modal.innerHTML = `<div class="modal"><article class="card"><p>MISSION 1 · THE FIRST SPARK</p><h1>Sammy the Adventurer</h1><p>A small journey through a familiar place—and a memory waiting to return.</p><button id="start">${label}</button>${resume ? '<button class="secondary" id="restart">Start over</button>' : ''}<p>Move with the buttons below. When an object glows, walk close and tap <b>Interact</b>.</p></article></div>`;
    this.modal.querySelector('#start')?.addEventListener('click', () => { this.modal.innerHTML = ''; this.scene.drawWorld(); });
    this.modal.querySelector('#restart')?.addEventListener('click', () => { resetProgress(); this.state = freshProgress(); saveProgress(this.state); this.refresh(); this.modal.innerHTML = ''; this.scene.drawWorld(); });
  }
  openJournal() { const entries = this.state.journalEntries.length ? this.state.journalEntries.map(e => `<div class="journal-entry"><b>${e.title}</b><br>${e.body}</div>`).join('') : '<p>Your handbag is still empty. The journey has just begun.</p>'; this.modal.innerHTML = `<div class="modal"><article class="card"><h2>Sammy’s Journal</h2>${entries}<button id="close">Close</button></article></div>`; this.modal.querySelector('#close')?.addEventListener('click', () => this.modal.innerHTML = ''); }
  togglePause() { this.paused = !this.paused; if (this.paused) { this.scene.scene.pause(); this.showMessage('Paused', 'Your progress is saved automatically.', () => { this.paused = false; this.scene.scene.resume(); }); } }
}

class AdventureScene extends Phaser.Scene {
  private readonly interactionRange = 50;
  private controller!: GameController; private player!: Phaser.GameObjects.Container; private target?: Point; private move = 0; private cursors!: Phaser.Types.Input.Keyboard.CursorKeys; private keys!: { A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key; E: Phaser.Input.Keyboard.Key; ENTER: Phaser.Input.Keyboard.Key }; private bowlingPins: Phaser.GameObjects.Container[] = []; private bowlingBall?: Phaser.GameObjects.Arc; private rolling = false; private mosquitoBuzz?: Phaser.Sound.BaseSound; private birdsAmbience?: Phaser.Sound.BaseSound; private finaleSong?: Phaser.Sound.BaseSound; private finaleSongStarted = false; private dedicationShown = false; private mosquitoSwarm: Phaser.GameObjects.Text[] = [];
  constructor() { super('adventure'); }
  preload() { this.load.image('sammyAvatarSource', sammyAvatarUrl); this.load.image('adityaAvatar', adityaAvatarUrl); this.load.image('pindLogo', pindLogoUrl); this.load.audio('mosquitoBuzz', mosquitoSoundUrl); this.load.audio('birdsAmbience', birdsSoundUrl); this.load.audio('finaleSong', finaleSongUrl); }
  create() {
    this.controller = (window as unknown as { controller?: GameController }).controller!;
    if (!this.controller) { const controller = new GameController(); (window as unknown as { controller: GameController }).controller = controller; this.controller = controller; }
    this.cursors = this.input.keyboard!.createCursorKeys(); this.keys = this.input.keyboard!.addKeys('A,D,E,ENTER') as typeof this.keys; this.makeSammySprite(); this.game.canvas.addEventListener('contextmenu', event => event.preventDefault()); this.game.canvas.addEventListener('selectstart', event => event.preventDefault());
    this.player = this.add.container(76, 510); this.drawSammy(); this.input.on('pointerdown', () => this.interact()); this.controller.attach(this);
  }
  setMove(direction: number) { this.move = direction; }
  update() { const keyboardMove = (this.cursors.left.isDown || this.keys.A.isDown) ? -1 : (this.cursors.right.isDown || this.keys.D.isDown) ? 1 : 0; const isEnding = this.controller.getState().step === 'adventure-complete'; const direction = isEnding ? 0 : keyboardMove || this.move; this.player.x = Phaser.Math.Clamp(this.player.x + direction * 2.3, 40, this.scale.width - 40); this.player.setScale(direction < 0 ? -1.04 : 1.04, 1.04); if (isEnding && this.finaleSongStarted && this.finaleSong && !this.finaleSong.isPlaying) this.showFinalDedication(); this.controller.setInteractionAvailable(this.inInteractionRange()); if (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.interact(); }
  private makeSammySprite() {
    if (this.textures.exists('sammyAvatar')) return;
    const source = this.textures.get('sammyAvatarSource').getSourceImage() as CanvasImageSource & { width: number; height: number };
    const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(source, 0, 0);
    const image = context.getImageData(0, 0, canvas.width, canvas.height); const { data } = image;
    const seen = new Uint8Array(canvas.width * canvas.height); const queue: number[] = [];
    const enqueue = (x: number, y: number) => { const p = y * canvas.width + x; const i = p * 4; if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height && !seen[p] && data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) { seen[p] = 1; queue.push(p); } };
    for (let x = 0; x < canvas.width; x++) { enqueue(x, 0); enqueue(x, canvas.height - 1); }
    for (let y = 0; y < canvas.height; y++) { enqueue(0, y); enqueue(canvas.width - 1, y); }
    for (let cursor = 0; cursor < queue.length; cursor++) { const p = queue[cursor]; const x = p % canvas.width; const y = Math.floor(p / canvas.width); data[p * 4 + 3] = 0; enqueue(x + 1, y); enqueue(x - 1, y); enqueue(x, y + 1); enqueue(x, y - 1); }
    context.putImageData(image, 0, 0);
    let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3]) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
    const padding = 8; left = Math.max(0, left - padding); top = Math.max(0, top - padding); right = Math.min(canvas.width - 1, right + padding); bottom = Math.min(canvas.height - 1, bottom + padding);
    const sprite = this.textures.createCanvas('sammyAvatar', right - left + 1, bottom - top + 1); if (!sprite) return;
    sprite.context.drawImage(canvas, left, top, right - left + 1, bottom - top + 1, 0, 0, sprite.width, sprite.height); sprite.refresh();
  }
  private drawSammy() {
    const shadow = this.add.graphics(); shadow.fillStyle(0x211526, .24).fillEllipse(0, 28, 42, 10); this.player.add(shadow);
    const portrait = this.add.image(0, -20, 'sammyAvatar').setDisplaySize(52, 94); this.player.add(portrait);
    this.tweens.add({ targets: this.player, y: this.player.y - 2, duration: 820, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  private drawPrince(x: number, y: number) {
    const npc = this.add.container(x, y); const g = this.add.graphics();
    g.fillStyle(0x11162b, .28).fillEllipse(0, 28, 40, 10);
    g.fillStyle(0x54372f).fillRect(-11, -31, 22, 21); // hair
    g.fillStyle(0xa96b50).fillRect(-8, -27, 16, 17); // face
    g.fillStyle(0x33231f).fillRect(-8, -30, 16, 6).fillRect(7, -25, 4, 12);
    g.fillStyle(0x3c2935).fillRect(-5, -19, 3, 3).fillRect(3, -19, 3, 3);
    g.fillStyle(0xb96d6b).fillRect(-2, -13, 5, 2);
    g.fillStyle(0x31476f).fillRect(-12, -8, 24, 24); // formal blue coat
    g.fillStyle(0xe5c36d).fillRect(-2, -7, 4, 21); // gold trim
    g.fillStyle(0xf4c98e).fillRect(-15, -5, 4, 17).fillRect(11, -5, 4, 17);
    g.fillStyle(0x20243e).fillRect(-9, 15, 7, 12).fillRect(2, 15, 7, 12);
    npc.add(g); npc.setScale(1.55); this.tweens.add({ targets: npc, y: y - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  private drawAdityaAvatar(x: number, y: number) {
    const avatar = this.add.container(x, y);
    const shadow = this.add.graphics(); shadow.fillStyle(0x11162b, .28).fillEllipse(0, 28, 44, 10); avatar.add(shadow);
    const portrait = this.add.image(-10, -10, 'adityaAvatar').setDisplaySize(150, 120);
    avatar.add(portrait);
    this.tweens.add({ targets: avatar, y: y - 2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  drawWorld() { const s = this.controller.getState(); const savedPlayerX = Math.min(this.player?.x ?? 76, this.scale.width - 40); const playerX = s.step === 'adventure-complete' ? 160 : savedPlayerX; this.stopMosquitoBuzz(); this.stopBirdsong(); if (s.step !== 'adventure-complete') { this.stopFinaleSong(); this.dedicationShown = false; document.querySelector('#final-dedication')?.remove(); } this.mosquitoSwarm = []; this.children.removeAll(); this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x2a234d).setOrigin(0); const step = s.step;
    if (s.missionId === 'mission-5') { if (step === 'park-arrival') this.drawPark('mosquitoes'); else if (step === 'mosquitoes-cleared') this.drawPark('moon'); else if (step === 'moon-found') this.drawFinalMemory(); else if (step === 'castle-garden') this.drawCastle(); else if (step === 'adventure-complete') this.drawEnd(); else this.drawPark('mosquitoes'); }
    else if (s.missionId === 'mission-4') { if (step === 'bowling-arrival') this.drawBowling('door'); else if (step === 'bowling-roll-1' || step === 'bowling-roll-2') this.drawBowling('roll'); else if (step === 'pin-collected') this.drawBowling('pin'); else if (step === 'bowling-memory') this.drawBowlingMemory(); else this.drawFinal(); }
    else if (s.missionId === 'mission-3') { if (step === 'pind-arrival') this.drawPind('door'); else if (step === 'pind-table') this.drawPind('chaas'); else if (step === 'chaas-finished') this.drawPind('photo'); else if (step === 'photo-collected') this.drawPindMemory(); else this.drawFinal(); }
    else if (s.missionId === 'mission-2') { if (step === 'sanctuary') this.drawSanctuary('birds'); else if (step === 'followed-birds') this.drawSanctuary('feather'); else if (step === 'feather-collected') this.drawSanctuaryMemory(); else this.drawFinal(); }
    else if (['bedroom', 'bag-picked'].includes(step)) this.drawBedroom(step); else if (step === 'cab-booked') this.drawCabRide(); else if (step === 'restaurant') this.drawRestaurant('door'); else if (step === 'menu-opened') this.drawRestaurant('menu'); else if (step === 'soup-ordered') this.drawRestaurant('soup'); else if (step === 'soup-finished') this.drawRestaurant('spark'); else if (step === 'spark-collected') this.drawMemory(); else this.drawFinal();
    this.player = this.add.container(playerX, 510); this.drawSammy(); if (step === 'adventure-complete') this.startFinaleSong(); this.controller.setInteractionAvailable(this.inInteractionRange());
  }
  private base(title: string, sky: number) { this.add.rectangle(0, 0, this.scale.width, this.scale.height, sky).setOrigin(0); this.add.text(20, 65, title, { fontFamily: 'Playfair Display', fontSize: '21px', color: '#fff2cc' }); this.add.rectangle(0, 545, this.scale.width, 155, 0x402e48).setOrigin(0); }
  private glow(x: number, y: number, label: string, id: string) {
    const circle = this.add.circle(x, y, 19, 0xffdf72, .18).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: circle, scale: 1.55, alpha: .7, duration: 700, yoyo: true, repeat: -1 });
    const caption = this.add.text(x, y + 28, `Tap: ${label}`, { fontSize: '10px', color: '#fff7bf' }).setOrigin(.5).setInteractive({ useHandCursor: true });
    this.target = { x, y: 510, id, label };
    circle.on('pointerdown', () => this.interact(true));
    caption.on('pointerdown', () => this.interact(true));
  }
  private drawBedroom(step: Step) {
    this.base('Sammy’s Bedroom', 0x5e486e);
    // Warm wallpaper, picture rail, and timber floor establish a distinct, cozy first scene.
    this.add.rectangle(0, 105, this.scale.width, 440, 0x9a7293).setOrigin(0);
    this.add.rectangle(0, 120, this.scale.width, 5, 0xf1ceaa).setOrigin(0);
    for (let x = 18; x < this.scale.width; x += 46) for (let y = 150; y < 330; y += 45) this.add.circle(x, y, 2, 0xc99caf, .5);
    this.add.rectangle(0, 510, this.scale.width, 35, 0x805a49).setOrigin(0);
    for (let x = 0; x < this.scale.width; x += 55) this.add.rectangle(x, 514, 2, 31, 0x654236).setOrigin(0);
    this.add.ellipse(122, 516, 170, 30, 0xd27683).setAlpha(.65);
    this.add.ellipse(122, 516, 140, 20, 0xf0b39c).setAlpha(.7);

    // A made bed with blanket, pillows and a dark timber headboard.
    this.add.rectangle(26, 300, 175, 155, 0x5b3b4d).setOrigin(0);
    this.add.rectangle(35, 322, 166, 126, 0xe9c6b8).setOrigin(0);
    this.add.rectangle(35, 375, 166, 73, 0xc66d83).setOrigin(0);
    this.add.rectangle(45, 332, 65, 34, 0xfff3d7).setOrigin(0).setStrokeStyle(2, 0xd9a991);
    this.add.rectangle(118, 332, 66, 34, 0xfff3d7).setOrigin(0).setStrokeStyle(2, 0xd9a991);
    this.add.rectangle(35, 405, 166, 6, 0xf1b385).setOrigin(0);
    this.add.rectangle(34, 447, 12, 53, 0x472d39).setOrigin(0); this.add.rectangle(188, 447, 12, 53, 0x472d39).setOrigin(0);
    this.add.text(112, 392, '✦', { fontSize: '16px', color: '#ffe8ac' }).setOrigin(.5);

    // Window and curtains carry evening light into the room.
    this.add.rectangle(260, 160, 96, 140, 0x553d59).setOrigin(0);
    this.add.rectangle(268, 169, 80, 122, 0x8bc3d1).setOrigin(0);
    this.add.rectangle(268, 240, 80, 51, 0xe89c86).setOrigin(0);
    this.add.circle(324, 202, 18, 0xffe5a6).setAlpha(.9);
    this.add.rectangle(306, 169, 4, 122, 0xf6dfbe).setOrigin(0); this.add.rectangle(268, 226, 80, 4, 0xf6dfbe).setOrigin(0);
    this.add.triangle(267, 162, 0, 0, 26, 0, 4, 136, 0x6c476e).setOrigin(0); this.add.triangle(323, 162, 0, 0, 26, 0, 22, 136, 0x6c476e).setOrigin(0);
    this.add.rectangle(255, 300, 108, 8, 0xf0c59f).setOrigin(0);

    // Small details make the room feel hers: a photo, books, plant, and bedside lamp.
    this.add.rectangle(220, 355, 70, 92, 0x704956).setOrigin(0);
    this.add.rectangle(228, 365, 54, 40, 0xf7dfb0).setOrigin(0).setStrokeStyle(3, 0x6e4654);
    this.add.circle(245, 385, 9, 0xd88982); this.add.circle(266, 385, 9, 0x8b6ca0); this.add.text(255, 377, '♥', { fontSize: '11px', color: '#f7e9c4' }).setOrigin(.5);
    this.add.rectangle(232, 413, 42, 5, 0xeeb776).setOrigin(0); this.add.rectangle(232, 421, 31, 5, 0x8eb0c0).setOrigin(0); this.add.rectangle(232, 429, 37, 5, 0xc97888).setOrigin(0);
    this.add.rectangle(304, 394, 32, 60, 0x7c4e49).setOrigin(0); this.add.circle(320, 374, 17, 0xf7dca0).setAlpha(.8); this.add.rectangle(314, 382, 12, 17, 0xf2c986).setOrigin(0);
    this.add.rectangle(65, 268, 40, 25, 0x5b3d52).setOrigin(0); this.add.text(72, 271, '✿', { fontSize: '20px', color: '#e7b5d2' });

    if (step === 'bedroom') { this.add.rectangle(108, 475, 33, 26, 0xfff8eb).setOrigin(0).setStrokeStyle(2, 0xc8b9b2); this.add.arc(124, 476, 9, Math.PI, 0, false, 0xb6a9a5, 2); this.glow(125, 500, 'white handbag', 'handbag'); }
    else if (step === 'bag-picked') { this.add.rectangle(286, 477, 22, 17, 0x2b2a45).setOrigin(0).setStrokeStyle(2, 0xf0cc9d); this.add.rectangle(290, 480, 14, 2, 0xb7d8dc).setOrigin(0); this.glow(298, 500, 'phone', 'phone'); }
  }
  private drawCabRide() {
    this.base('Outside Sammy’s Home · 1 PM', 0x8fd0e7); this.add.rectangle(0, 105, this.scale.width, 230, 0xa9dbee).setOrigin(0); this.add.circle(329, 151, 32, 0xffe49a); this.add.circle(329, 151, 44, 0xffe49a, .14); this.add.ellipse(80, 157, 72, 18, 0xf6fcf3, .85); this.add.ellipse(126, 165, 48, 14, 0xf6fcf3, .8);
    this.add.rectangle(0, 335, this.scale.width, 120, 0x8f8b87).setOrigin(0); this.add.rectangle(0, 455, this.scale.width, 90, 0x3c4555).setOrigin(0); for (let x = 20; x < this.scale.width; x += 70) this.add.rectangle(x, 493, 42, 5, 0xf6e0a2).setOrigin(0);
    this.add.rectangle(22, 226, 111, 180, 0xd8b18d).setOrigin(0).setStrokeStyle(3, 0x806b69); this.add.rectangle(37, 257, 43, 51, 0x94c7d7).setOrigin(0).setStrokeStyle(3, 0x655b69); this.add.rectangle(88, 258, 29, 148, 0x744d54).setOrigin(0); this.add.triangle(15, 228, 140, 228, 78, 181, 0xb9675a).setOrigin(0);
    this.add.circle(365, 338, 35, 0x4c8a65); this.add.circle(342, 354, 31, 0x5b9d70); this.add.rectangle(352, 353, 13, 91, 0x5d4a42).setOrigin(0); this.add.text(151, 274, 'Your cab is here!', { fontFamily: 'Playfair Display', fontSize: '20px', color: '#4d596e' });
    this.add.rectangle(203, 402, 137, 67, 0xf0bb51).setOrigin(0).setStrokeStyle(3, 0x8d5a43); this.add.rectangle(222, 411, 51, 27, 0xa8d8e6).setOrigin(0).setStrokeStyle(2, 0x705667); this.add.rectangle(277, 411, 43, 27, 0xa8d8e6).setOrigin(0).setStrokeStyle(2, 0x705667); this.add.rectangle(259, 393, 27, 12, 0xf0bb51).setOrigin(0); this.add.text(262, 395, 'CAB', { fontSize: '7px', color: '#493c45' }); this.add.circle(231, 470, 18, 0x282d3c); this.add.circle(314, 470, 18, 0x282d3c); this.add.circle(231, 470, 7, 0xd8d6cc); this.add.circle(314, 470, 7, 0xd8d6cc); this.add.circle(328, 446, 4, 0xfff2a4);
    this.glow(274, 500, 'get in cab', 'cab');
  }
  private drawRestaurant(id: 'door' | 'menu' | 'soup' | 'spark', interactive = true) {
    if (id === 'door') {
      this.base('Masaldani', 0x8fcde0);
      this.add.circle(332, 143, 31, 0xffe39a); this.add.circle(332, 143, 43, 0xffe39a, .15); this.add.ellipse(73, 144, 62, 17, 0xf4fbf0, .82); this.add.ellipse(112, 151, 48, 14, 0xf4fbf0, .78);
      this.add.rectangle(0, 190, this.scale.width, 215, 0xbf8060).setOrigin(0); // sunlit façade
      this.add.rectangle(0, 365, this.scale.width, 180, 0xb2a49b).setOrigin(0); // pavement
      for (let x = 0; x < this.scale.width; x += 44) this.add.rectangle(x, 455, 32, 3, 0x91847e).setOrigin(0);
      this.add.rectangle(38, 210, 316, 78, 0x753f35).setOrigin(0).setStrokeStyle(4, 0xf1b867);
      this.add.text(this.scale.width / 2, 226, 'MASALDANI', { fontFamily: 'Playfair Display', fontSize: '34px', color: '#ffe6a3', stroke: '#573043', strokeThickness: 3 }).setOrigin(.5);
      this.add.text(this.scale.width / 2, 261, 'comfort in every spoonful', { fontSize: '10px', color: '#f6c78d' }).setOrigin(.5);
      this.add.rectangle(56, 313, 90, 112, 0x96d1d7).setOrigin(0).setStrokeStyle(5, 0x6c4350); this.add.rectangle(244, 313, 90, 112, 0x96d1d7).setOrigin(0).setStrokeStyle(5, 0x6c4350);
      this.add.rectangle(69, 327, 64, 84, 0xdca477).setOrigin(0); this.add.rectangle(257, 327, 64, 84, 0xdca477).setOrigin(0);
      this.add.polygon(94, 344, [0, 0, 22, 0, 0, 55], 0xfff5c5, .55); this.add.polygon(284, 344, [0, 0, 22, 0, 0, 55], 0xfff5c5, .55);
      this.add.rectangle(164, 299, 66, 105, 0x573549).setOrigin(0).setStrokeStyle(5, 0xe8b76e); this.add.rectangle(183, 326, 28, 78, 0x78545a).setOrigin(0); this.add.circle(205, 370, 3, 0xf0c87e);
      this.add.circle(34, 418, 28, 0x456c5c); this.add.circle(56, 404, 27, 0x517d65); this.add.circle(358, 418, 31, 0x456c5c); this.add.circle(335, 406, 25, 0x517d65);
      this.add.text(52, 168, '☁', { fontSize: '22px', color: '#f8fbf1' }); this.add.text(205, 145, '☁', { fontSize: '15px', color: '#f8fbf1' });
      if (interactive) this.glow(198, 500, 'restaurant door', 'door'); return;
    }

    this.base('Masaldani', 0x804f44);
    this.add.rectangle(0, 105, this.scale.width, 278, 0x9d624d).setOrigin(0);
    this.add.rectangle(0, 121, this.scale.width, 7, 0xf2c37d).setOrigin(0);
    this.add.text(this.scale.width / 2, 148, 'MASALDANI', { fontFamily: 'Playfair Display', fontSize: '27px', color: '#ffe1a1', stroke: '#623640', strokeThickness: 2 }).setOrigin(.5);
    // glowing lanterns, wall niches and a patterned tile band
    for (const x of [58, 195, 332]) { this.add.line(x, 164, x, 190, 0xf0cc91, 2); this.add.circle(x, 196, 10, 0xffd77c); this.add.circle(x, 196, 16, 0xffd77c, .14); }
    for (let x = 0; x < this.scale.width; x += 24) this.add.rectangle(x, 340, 13, 8, x % 48 ? 0xc27b62 : 0xf0bd7c).setOrigin(0);
    this.add.rectangle(17, 235, 74, 84, 0x674351).setOrigin(0).setStrokeStyle(3, 0xf0c97f); this.add.text(54, 250, 'home\nflavour', { align: 'center', fontFamily: 'Playfair Display', fontSize: '16px', color: '#ffe4a6', lineSpacing: 5 }).setOrigin(.5, 0);
    // Table, place settings and chairs form the playable focus.
    this.add.ellipse(260, 394, 145, 32, 0x6c3c2e); this.add.rectangle(194, 394, 132, 16, 0x7d4730).setOrigin(0); this.add.rectangle(212, 409, 13, 88, 0x61382e).setOrigin(0); this.add.rectangle(297, 409, 13, 88, 0x61382e).setOrigin(0);
    this.add.rectangle(200, 424, 38, 56, 0x79465a).setOrigin(0); this.add.rectangle(287, 424, 38, 56, 0x79465a).setOrigin(0); this.add.ellipse(263, 383, 48, 13, 0xffead0).setStrokeStyle(2, 0xd6a76c);
    this.add.rectangle(242, 364, 7, 20, 0xf3d7a0).setOrigin(0); this.add.rectangle(277, 364, 7, 20, 0xf3d7a0).setOrigin(0);
    // The decorative plant is the artifact's eventual hiding place.
    this.add.rectangle(38, 420, 54, 58, 0x714333).setOrigin(0); this.add.circle(64, 397, 31, 0x4f8165); this.add.circle(38, 410, 23, 0x5c936d); this.add.circle(86, 414, 21, 0x3d705a); this.add.circle(70, 370, 22, 0x639e70);
    if (id === 'menu') { this.add.rectangle(250, 338, 27, 45, 0xfff2d3).setOrigin(0).setStrokeStyle(2, 0xca996b); this.add.text(263, 346, 'MENU', { fontSize: '6px', color: '#7a4b43' }).setOrigin(.5); if (interactive) this.glow(265, 500, 'menu', 'menu'); }
    if (id === 'soup') { this.add.circle(263, 379, 27, 0xf4e6cc).setStrokeStyle(3, 0xc37e4d); this.add.circle(263, 376, 19, 0xf5c95f); this.add.circle(257, 371, 4, 0xffe59b); this.add.line(289, 354, 300, 340, 0xe6d5b1, 3); if (interactive) this.glow(265, 500, 'golden soup', 'soup'); }
    if (id === 'spark') { this.add.circle(68, 391, 18, 0xffe67a, .22); this.add.text(68, 372, '✦', { fontSize: '29px', color: '#fff1a7' }).setOrigin(.5); if (interactive) this.glow(68, 435, 'First Spark', 'spark'); }
  }
  private drawMemory() { this.base('A Memory Returns', 0x78b9d3); this.add.rectangle(0, 105, this.scale.width, 300, 0x8ec9de).setOrigin(0); this.add.circle(292, 159, 38, 0xffdd87); this.add.circle(292, 159, 53, 0xffdd87, .14); this.add.ellipse(84, 161, 72, 17, 0xf4fbef, .78); this.add.ellipse(131, 170, 51, 14, 0xf4fbef, .72); this.add.rectangle(0, 500, this.scale.width, 45, 0x416a75).setOrigin(0); this.add.text(this.scale.width / 2, 275, 'Cool breeze in the air…\nA familiar feeling…\nAnd birds beside a river.', { align: 'center', fontFamily: 'Playfair Display', fontSize: '22px', color: '#f9fbdf', lineSpacing: 9 }).setOrigin(.5); this.target = { x: this.scale.width / 2, y: 510, id: 'memory', label: 'remember' }; this.add.text(this.scale.width / 2, 460, 'Tap Interact to follow the memory', { fontSize: '11px', color: '#f8f6d0' }).setOrigin(.5); }
  private startBirdsong() { if (!this.cache.audio.exists('birdsAmbience') || this.birdsAmbience?.isPlaying) return; this.birdsAmbience = this.sound.add('birdsAmbience', { loop: true, volume: .132 }); this.birdsAmbience.play(); }
  private stopBirdsong() { if (this.birdsAmbience) { this.birdsAmbience.stop(); this.birdsAmbience.destroy(); this.birdsAmbience = undefined; } }
  private drawSanctuary(id: 'birds' | 'feather') {
    this.startBirdsong();
    this.base('Yamuna Bird Sanctuary', 0xd97769);
    // Layered sunset colours make the sanctuary feel open and tranquil.
    this.add.rectangle(0, 105, this.scale.width, 80, 0xe58b75).setOrigin(0); this.add.rectangle(0, 185, this.scale.width, 88, 0xf0ac7d).setOrigin(0); this.add.rectangle(0, 273, this.scale.width, 77, 0xf5c18a).setOrigin(0);
    this.add.circle(303, 177, 47, 0xffe09a); this.add.circle(303, 177, 62, 0xffe09a, .13);
    // Distant banks, river and reflections.
    this.add.rectangle(0, 329, this.scale.width, 54, 0x667a69).setOrigin(0); this.add.rectangle(0, 383, this.scale.width, 137, 0x527e93).setOrigin(0);
    for (let y = 400; y < 505; y += 17) { const start = 135 + (y % 31); this.add.rectangle(start, y, 115, 3, 0xdba27f, .36).setOrigin(0); this.add.rectangle(22, y + 7, 73, 2, 0xaacbd0, .4).setOrigin(0); }
    this.add.rectangle(0, 490, this.scale.width, 55, 0x3d654d).setOrigin(0); this.add.rectangle(0, 514, this.scale.width, 31, 0x315847).setOrigin(0);
    // Reeds along the shore.
    for (const x of [18, 31, 44, 92, 105, 337, 349, 364]) { this.add.line(x, 494, x + (x % 3) * 3, 442, 0x294d43, 3); this.add.ellipse(x + 5, 449, 6, 17, 0x79564a); }
    // Large foreground trees frame the river without blocking its sunset.
    this.add.rectangle(25, 287, 17, 157, 0x4b4741).setOrigin(0); this.add.circle(37, 282, 48, 0x405e50); this.add.circle(7, 305, 38, 0x4c735b); this.add.circle(67, 315, 42, 0x36594d);
    this.add.rectangle(348, 296, 17, 145, 0x4b4741).setOrigin(0); this.add.circle(355, 290, 52, 0x405e50); this.add.circle(330, 317, 43, 0x4c735b); this.add.circle(383, 324, 37, 0x36594d);
    // Bird silhouettes drift together through the warm sky.
    const flock = this.add.container(0, 0); for (let i = 0; i < 5; i++) flock.add(this.add.text(116 + i * 26, 230 + (i % 2) * 9, '⌁', { fontSize: '24px', color: '#47394b' })); this.tweens.add({ targets: flock, x: 28, y: -7, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (id === 'feather') { const aura = this.add.circle(247, 381, 28, 0xd9f4db, .18); this.tweens.add({ targets: aura, scale: 1.65, alpha: .48, duration: 900, yoyo: true, repeat: -1 }); const feather = this.add.container(247, 368); feather.add(this.add.line(0, 9, -2, 35, 2, -28, 0xc99b52, 3)); feather.add(this.add.ellipse(0, -4, 26, 51, 0x3b9b83).setAngle(-13)); feather.add(this.add.ellipse(0, -9, 18, 33, 0x236f82).setAngle(-13)); feather.add(this.add.ellipse(0, -13, 10, 18, 0x164f86).setAngle(-13)); feather.add(this.add.circle(0, -14, 5, 0xe7c55f)); feather.add(this.add.circle(0, -14, 2, 0x1d325c)); this.tweens.add({ targets: feather, y: 357, angle: 4, duration: 1050, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); }
    this.glow(id === 'birds' ? 182 : 250, id === 'birds' ? 500 : 435, id === 'birds' ? 'follow the birds' : 'Peacock Feather', id);
  }
  private drawSanctuaryMemory() { this.base('The Peacock Feather', 0xd77768); this.add.rectangle(0, 105, this.scale.width, 115, 0xe98c71).setOrigin(0); this.add.rectangle(0, 220, this.scale.width, 120, 0xf2af7d).setOrigin(0); this.add.rectangle(0, 340, this.scale.width, 180, 0x537f90).setOrigin(0); this.add.circle(286, 251, 42, 0xffcb73); this.add.rectangle(0, 285, this.scale.width, 55, 0x5b776d).setOrigin(0); for (let y = 357; y < 500; y += 17) { const width = 26 + (y - 357) * .7; this.add.rectangle(286 - width / 2, y, width, 4, 0xffc56f, .68).setOrigin(0); } this.add.circle(49, 323, 38, 0x3d6657); this.add.circle(351, 329, 46, 0x3d6657); this.add.text(130, 191, '⌁   ⌁   ⌁', { fontSize: '22px', color: '#4b4052' }); this.add.text(this.scale.width / 2, 165, 'Sunset on the river…\nBirdsong…\nAnd someone beside her.', { align: 'center', fontFamily: 'Playfair Display', fontSize: '22px', color: '#fff8d8', stroke: '#8a514b', strokeThickness: 2, lineSpacing: 9 }).setOrigin(.5); this.target = { x: this.scale.width / 2, y: 510, id: 'sanctuary-memory', label: 'remember' }; this.add.text(this.scale.width / 2, 460, 'Tap Interact to follow the memory', { fontSize: '11px', color: '#fff2bd' }).setOrigin(.5); }
  private drawPind(id: 'door' | 'chaas' | 'photo') {
    if (id === 'door') {
      this.base('Pind Baluchi', 0x5a3546);
      this.add.rectangle(0, 105, this.scale.width, 310, 0x944c35).setOrigin(0); this.add.rectangle(0, 415, this.scale.width, 130, 0x4a3841).setOrigin(0);
      for (let x = 12; x < this.scale.width; x += 58) { this.add.rectangle(x, 242, 42, 128, 0x783b31).setOrigin(0); this.add.rectangle(x + 5, 247, 32, 52, 0xf0b66f).setOrigin(0); }
      this.add.rectangle(67, 128, 256, 115, 0xfff6dc).setOrigin(0).setStrokeStyle(4, 0xd09b42); this.add.image(this.scale.width / 2, 180, 'pindLogo').setDisplaySize(225, 110);
      this.add.rectangle(154, 285, 82, 130, 0x51313a).setOrigin(0).setStrokeStyle(5, 0xf0bd6e); this.add.rectangle(178, 307, 34, 108, 0x765155).setOrigin(0); this.add.circle(206, 361, 3, 0xf2d888);
      this.add.circle(37, 400, 31, 0x3f6c52); this.add.circle(357, 400, 35, 0x3f6c52); this.add.text(70, 350, '✦', { fontSize: '17px', color: '#ffd878' }); this.add.text(314, 335, '✦', { fontSize: '14px', color: '#ffd878' });
      this.glow(195, 500, 'enter restaurant', 'pindDoor'); return;
    }

    this.base('Pind Baluchi', 0x8b4939);
    this.add.rectangle(0, 105, this.scale.width, 240, 0xc06b43).setOrigin(0); this.add.rectangle(0, 121, this.scale.width, 7, 0xf1ba65).setOrigin(0);
    this.add.image(195, 178, 'pindLogo').setDisplaySize(175, 85);
    // Folk-art border and warm hanging lanterns.
    for (let x = 5; x < this.scale.width; x += 30) { this.add.circle(x, 295, 7, x % 60 ? 0xf4be6a : 0x3b7c64); this.add.circle(x + 10, 306, 5, 0xf0ddaa); }
    for (const x of [62, 195, 328]) { this.add.line(x, 222, x, 260, 0xf3cc85, 2); this.add.rectangle(x - 8, 260, 16, 22, 0x8b4b39).setStrokeStyle(2, 0xf1c870); this.add.circle(x, 271, 6, 0xffdb78); }
    this.add.rectangle(22, 309, 80, 76, 0x6a3b35).setOrigin(0).setStrokeStyle(3, 0xf0c67b); this.add.text(62, 335, 'welcome', { align: 'center', fontFamily: 'Playfair Display', fontSize: '17px', color: '#ffe5a7' }).setOrigin(.5, 0);
    // Carved wooden table with copper plates and cushions.
    this.add.ellipse(262, 396, 151, 34, 0x673b2d); this.add.rectangle(190, 396, 145, 17, 0x75422d).setOrigin(0); this.add.rectangle(212, 411, 14, 88, 0x57342d).setOrigin(0); this.add.rectangle(300, 411, 14, 88, 0x57342d).setOrigin(0);
    this.add.rectangle(198, 430, 43, 49, 0xaa5862).setOrigin(0); this.add.rectangle(285, 430, 43, 49, 0x3d7468).setOrigin(0); this.add.ellipse(263, 383, 55, 14, 0xe8b76c).setStrokeStyle(2, 0x966044);
    this.add.rectangle(239, 364, 8, 19, 0xf5d79e).setOrigin(0); this.add.rectangle(279, 364, 8, 19, 0xf5d79e).setOrigin(0);
    this.add.rectangle(111, 391, 42, 82, 0x684037).setOrigin(0); this.add.circle(132, 380, 25, 0x4a7a58); this.add.circle(112, 391, 19, 0x598f64); this.add.circle(151, 400, 18, 0x3f6e51);
    if (id === 'chaas') { this.add.rectangle(251, 341, 27, 42, 0xb7dbd3).setOrigin(0).setStrokeStyle(2, 0xe4f7e7); this.add.rectangle(255, 346, 19, 30, 0xf4fff1).setOrigin(0); this.add.line(273, 345, 283, 331, 0xf3d49a, 2); this.glow(265, 500, 'glass of chaas', 'chaas'); }
    if (id === 'photo') { this.add.rectangle(241, 332, 45, 55, 0xf2d59c).setOrigin(0).setStrokeStyle(4, 0x72433c); this.add.rectangle(247, 338, 33, 38, 0x8e6c79).setOrigin(0); this.add.circle(258, 354, 7, 0xf2ae85); this.add.circle(270, 354, 7, 0xd69570); this.add.text(264, 362, '♥', { fontSize: '10px', color: '#fff0ca' }).setOrigin(.5); this.glow(265, 500, 'treasured photograph', 'photo'); }
  }
  private drawPindMemory() { this.base('A Joyful Memory', 0x69415f); this.add.text(this.scale.width / 2, 265, 'Laughter over a meal…\nEye contact...\nA silly photograph…\nA sense of belonging...', { align: 'center', fontFamily: 'Playfair Display', fontSize: '21px', color: '#fff3d2', lineSpacing: 9 }).setOrigin(.5); this.target = { x: this.scale.width / 2, y: 510, id: 'pind-memory', label: 'remember' }; this.add.text(this.scale.width / 2, 460, 'Tap Interact to follow the memory', { fontSize: '11px', color: '#fff2bd' }).setOrigin(.5); }
  private drawBowling(id: 'door' | 'roll' | 'pin') {
    this.bowlingPins = []; this.bowlingBall = undefined; this.rolling = false;
    if (id === 'door') {
      this.base('Lucky Strike Bowling', 0x202b56); this.add.rectangle(0, 105, this.scale.width, 310, 0x303e72).setOrigin(0); this.add.rectangle(0, 415, this.scale.width, 130, 0x252944).setOrigin(0);
      this.add.rectangle(30, 158, 330, 95, 0x15234e).setOrigin(0).setStrokeStyle(4, 0xfece68); this.add.text(195, 176, 'LUCKY STRIKE', { fontFamily: 'Playfair Display', fontSize: '34px', color: '#ffe46e', stroke: '#e6557c', strokeThickness: 3 }).setOrigin(.5); this.add.text(195, 218, 'BOWLING  •  ARCADE  •  FUN', { fontSize: '10px', color: '#80d9e4' }).setOrigin(.5);
      for (const x of [68, 322]) { this.add.rectangle(x - 26, 290, 52, 100, 0x74b6d2).setOrigin(0).setStrokeStyle(4, 0x192747); this.add.circle(x, 337, 16, 0xf3c266); }
      this.add.rectangle(159, 279, 72, 136, 0x171a37).setOrigin(0).setStrokeStyle(4, 0xf4c366); this.add.rectangle(180, 301, 30, 114, 0x324472).setOrigin(0); this.add.circle(204, 355, 3, 0xffe07b); this.add.text(47, 126, '✦', { fontSize: '17px', color: '#aee8f0' }); this.add.text(330, 135, '✦', { fontSize: '14px', color: '#aee8f0' });
      this.glow(195, 500, 'enter bowling', 'bowlingDoor'); return;
    }
    this.base('Lucky Strike Bowling', 0x202c56); this.add.rectangle(0, 105, this.scale.width, 245, 0x303e70).setOrigin(0); this.add.rectangle(0, 126, this.scale.width, 6, 0x71d2df).setOrigin(0);
    this.add.text(195, 150, 'LUCKY STRIKE', { fontFamily: 'Playfair Display', fontSize: '27px', color: '#ffe16e', stroke: '#df5b7b', strokeThickness: 2 }).setOrigin(.5);
    this.add.rectangle(23, 181, 94, 54, 0x172348).setOrigin(0).setStrokeStyle(2, 0x74dbe1); this.add.text(70, 190, `SAMMY\n${id === 'pin' ? 'STRIKE!  10' : 'FRAME 1'}`, { align: 'center', fontSize: '11px', color: '#eaffff', lineSpacing: 5 }).setOrigin(.5, 0);
    // Lane perspective, gutters, ball return and a bright pin deck.
    this.add.triangle(112, 488, 303, 488, 282, 254, 137, 254, 0xb58269).setOrigin(0); this.add.triangle(91, 490, 112, 488, 137, 254, 124, 254, 0x474764).setOrigin(0); this.add.triangle(303, 488, 325, 490, 296, 254, 282, 254, 0x474764).setOrigin(0);
    for (let y = 290; y < 480; y += 34) this.add.rectangle(142 - (y - 290) / 14, y, 140 + (y - 290) / 7, 2, 0xe5be8b, .3).setOrigin(0);
    this.add.rectangle(132, 238, 168, 22, 0x151b39).setOrigin(0).setStrokeStyle(3, 0x75d9e4); this.add.text(216, 241, 'PIN DECK', { fontSize: '9px', color: '#dbfbff' }).setOrigin(.5, 0);
    this.add.ellipse(70, 458, 88, 45, 0x1a2348).setStrokeStyle(3, 0x70cbd9); this.add.circle(50, 452, 11, 0xdc6680); this.add.circle(74, 448, 11, 0x7e81d7); this.add.circle(95, 457, 11, 0xf0c45f);
    if (id === 'roll') {
      const pinLayout = [[216, 275], [207, 284], [225, 284], [198, 294], [216, 294], [234, 294], [189, 305], [207, 305], [225, 305], [243, 305]];
      for (const [x, y] of pinLayout) { const pin = this.add.container(x, y); const body = this.add.graphics(); body.fillStyle(0xfff7df).fillCircle(0, 3, 6).fillRect(-4, 2, 8, 13); body.fillStyle(0xdf5367).fillRect(-4, 6, 8, 3); pin.add(body); this.bowlingPins.push(pin); }
      this.bowlingBall = this.add.circle(120, 465, 17, 0x8d4e89).setStrokeStyle(2, 0xf1b7b0);
      this.glow(120, 500, 'roll for a strike', 'roll');
    }
    if (id === 'pin') { const lucky = this.add.container(216, 289); const pin = this.add.graphics(); pin.fillStyle(0xfff6dc).fillCircle(0, 0, 12).fillRect(-8, 0, 16, 31); pin.fillStyle(0xf3c85f).fillRect(-8, 9, 16, 5); lucky.add(pin); const aura = this.add.circle(216, 300, 25, 0xffe574, .22); this.tweens.add({ targets: aura, scale: 1.7, alpha: .55, duration: 850, yoyo: true, repeat: -1 }); this.glow(216, 435, 'Lucky Pin', 'luckyPin'); }
  }
  private playStrike() {
    if (this.rolling || !this.bowlingBall) return; this.rolling = true; this.target = undefined;
    this.tweens.add({ targets: this.bowlingBall, x: 216, y: 300, scale: .45, duration: 720, ease: 'Quad.easeIn' });
    this.time.delayedCall(560, () => this.bowlingPins.forEach((pin, index) => this.tweens.add({ targets: pin, angle: index % 2 ? 82 : -82, x: pin.x + (index - 5) * 6, y: pin.y + 14, duration: 260, delay: (index % 4) * 45, ease: 'Back.easeIn' })));
    this.time.delayedCall(1050, () => this.controller.showMessage('STRIKE!', 'All ten pins fall in one perfect roll. Among them, one pin glows with a familiar warmth.', () => this.controller.advance('pin-collected', { bowlingPins: 10 })));
  }
  private drawBowlingMemory() { this.base('A Moonlit Memory', 0x27305e); this.add.circle(285, 145, 44, 0xfff0b2); this.add.text(this.scale.width / 2, 275, 'A rolling ball…\nA burst of laughter…\nThen quiet moonlight shared with \nsomeone special.', { align: 'center', fontFamily: 'Playfair Display', fontSize: '21px', color: '#fff7d7', lineSpacing: 9 }).setOrigin(.5); this.target = { x: this.scale.width / 2, y: 510, id: 'bowling-memory', label: 'remember' }; this.add.text(this.scale.width / 2, 460, 'Tap Interact to follow the memory', { fontSize: '11px', color: '#fff2bd' }).setOrigin(.5); }
  private startMosquitoBuzz() { if (!this.cache.audio.exists('mosquitoBuzz') || this.mosquitoBuzz?.isPlaying) return; this.mosquitoBuzz = this.sound.add('mosquitoBuzz', { loop: true, volume: .18 }); this.mosquitoBuzz.play(); }
  private stopMosquitoBuzz() { if (this.mosquitoBuzz) { this.mosquitoBuzz.stop(); this.mosquitoBuzz.destroy(); this.mosquitoBuzz = undefined; } }
  private shooMosquitoes() {
    if (!this.mosquitoSwarm.length) return; this.target = undefined; this.stopMosquitoBuzz();
    this.mosquitoSwarm.forEach((mosquito, index) => this.tweens.add({ targets: mosquito, x: mosquito.x + 95 + index * 12, y: mosquito.y - 68 - index * 8, alpha: 0, angle: index % 2 ? 35 : -35, duration: 420, delay: index * 45, ease: 'Quad.easeOut' }));
    this.time.delayedCall(700, () => this.controller.showMessage('A peaceful night', 'Sammy waves the mosquitoes away with a laugh. The buzzing fades, leaving only the quiet park and moonlight.', () => this.controller.advance('mosquitoes-cleared')));
  }
  private drawPark(id: 'path' | 'mosquitoes' | 'moon') {
    this.base('Machardutam Park', 0x1b2a4b); this.add.circle(294, 135, 42, 0xfff4c2); this.add.circle(294, 135, 59, 0xfff4c2, .1); this.add.rectangle(0, 460, this.scale.width, 85, 0x294a49).setOrigin(0); this.add.circle(55, 325, 65, 0x24463e); this.add.circle(340, 350, 72, 0x24463e); this.add.text(100, 185, '✦     ·    ✦   ·', { fontSize: '17px', color: '#ffefb2' });
    if (id === 'mosquitoes') { const positions = [[174, 334], [204, 318], [231, 346], [254, 327], [215, 365]]; this.mosquitoSwarm = positions.map(([x, y], index) => { const mosquito = this.add.text(x, y, '⌁', { fontSize: '27px', color: '#d6aa7a' }).setOrigin(.5); this.tweens.add({ targets: mosquito, x: x + (index % 2 ? 10 : -10), y: y + (index % 2 ? -9 : 9), duration: 330 + index * 55, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); return mosquito; }); this.startMosquitoBuzz(); }
    if (id === 'moon') { for (let i = 0; i < 5; i++) { const stone = this.add.ellipse(158 + i * 31, 465 - i * 16, 28 - i * 3, 9 - i, 0x91a8b3, .75); stone.setAngle(-8 + i * 5); } const aura = this.add.circle(285, 258, 42, 0xd8eff5, .13); this.tweens.add({ targets: aura, scale: 1.75, alpha: .45, duration: 900, yoyo: true, repeat: -1 }); const shard = this.add.graphics(); shard.fillStyle(0xd8f7ff).fillPoints([{ x: 285, y: 221 }, { x: 302, y: 253 }, { x: 285, y: 294 }, { x: 268, y: 253 }], true); shard.lineStyle(2, 0xffffff, .85).strokePoints([{ x: 285, y: 221 }, { x: 302, y: 253 }, { x: 285, y: 294 }, { x: 268, y: 253 }], true); this.tweens.add({ targets: shard, y: -9, alpha: .7, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); for (const [x, y] of [[250, 235], [320, 243], [262, 283], [313, 292]]) { const star = this.add.text(x, y, '✦', { fontSize: '14px', color: '#f7f4c2' }); this.tweens.add({ targets: star, alpha: .25, duration: 600, yoyo: true, repeat: -1, delay: x % 120 }); } }
    this.glow(id === 'path' ? 300 : id === 'mosquitoes' ? 100 : 285, 500, id === 'path' ? 'walk into park' : id === 'mosquitoes' ? 'shoo mosquitoes' : 'follow moonlight', id === 'path' ? 'parkPath' : id === 'moon' ? 'moon' : 'mosquitoes');
  }
  private drawFinalMemory() { this.base('The Final Memory', 0x26335f); this.add.circle(285, 145, 44, 0xfff0b2); this.add.circle(285, 145, 61, 0xfff0b2, .1); for (const [x, y] of [[54, 185], [102, 228], [338, 211], [350, 286], [71, 334]]) this.add.text(x, y, '✦', { fontSize: '13px', color: '#f6ecc1' }); this.add.triangle(85, 500, 150, 500, 238, 325, 207, 325, 0x76869c, .45).setOrigin(0); this.add.text(this.scale.width / 2, 270, 'Of course.\nI’ve been trying to find you.\n\nThe moon reveals a path to the castle.', { align: 'center', fontFamily: 'Playfair Display', fontSize: '22px', color: '#fff7d7', lineSpacing: 10 }).setOrigin(.5); this.target = { x: this.scale.width / 2, y: 510, id: 'final-memory', label: 'remember' }; this.add.text(this.scale.width / 2, 460, 'Tap Interact to follow the moonlit path', { fontSize: '11px', color: '#fff2bd' }).setOrigin(.5); }
  private drawCastle() {
    this.base('The Castle Garden', 0x202449); this.add.circle(285, 125, 50, 0xfff2ba); this.add.circle(285, 125, 70, 0xfff2ba, .08); this.add.rectangle(0, 408, this.scale.width, 137, 0x294b4b).setOrigin(0);
    // Castle silhouette: central keep, two turrets, roof lines and lit windows.
    this.add.rectangle(86, 263, 220, 159, 0x4d486a).setOrigin(0); this.add.rectangle(115, 202, 51, 220, 0x565176).setOrigin(0); this.add.rectangle(225, 202, 51, 220, 0x565176).setOrigin(0); this.add.triangle(108, 202, 173, 202, 141, 164, 0x6f526f).setOrigin(0); this.add.triangle(218, 202, 283, 202, 251, 164, 0x6f526f).setOrigin(0);
    for (const [x, y] of [[132, 250], [240, 250], [180, 306], [214, 306]]) { this.add.rectangle(x, y, 13, 22, 0xffd98a).setOrigin(0); this.add.rectangle(x + 5, y, 2, 22, 0x95647a).setOrigin(0); }
    this.add.rectangle(178, 365, 39, 57, 0x292d52).setOrigin(0).setStrokeStyle(3, 0x9e7b88); this.add.arc(197, 366, 19, Math.PI, 0, false, 0x292d52).setOrigin(0);
    // Garden path and flowers lead the eye to the reunion.
    this.add.triangle(128, 545, 262, 545, 220, 414, 176, 414, 0x8ba5a1).setOrigin(0); for (let y = 435; y < 535; y += 23) this.add.ellipse(196, y, 34 + (y - 435) / 3, 8, 0xc5d9c4, .7);
    for (const x of [32, 55, 79, 311, 336, 360]) { this.add.circle(x, 448 + (x % 2) * 12, 22, 0x376757); this.add.text(x - 7, 429 + (x % 3) * 7, '✿', { fontSize: '18px', color: x % 2 ? '#ec93a9' : '#f2cf78' }); }
    this.drawAdityaAvatar(250, 495); this.add.text(260, 400, 'waiting beneath the moon', { fontSize: '10px', color: '#fff1bf' }).setOrigin(.5); this.glow(240, 500, 'take his hand', 'castle');
  }
  private startFinaleSong() {
    if (!this.cache.audio.exists('finaleSong') || this.finaleSong?.isPlaying) return;
    this.finaleSong = this.sound.add('finaleSong', { volume: .28 });
    const revealDedication = () => this.showFinalDedication();
    window.setTimeout(revealDedication, 60_000);
    this.finaleSong.once('complete', revealDedication);
    this.finaleSong.once('play', () => {
      this.finaleSongStarted = true;
      const duration = this.finaleSong?.duration ?? 0;
      if (duration > 0) this.time.delayedCall((duration + .25) * 1000, revealDedication);
    });
    this.finaleSong.play();
  }
  private stopFinaleSong() { this.finaleSongStarted = false; if (this.finaleSong) { this.finaleSong.stop(); this.finaleSong.destroy(); this.finaleSong = undefined; } }
  private showFinalDedication() {
    if (this.dedicationShown || this.controller.getState().step !== 'adventure-complete') return;
    this.dedicationShown = true;
    const dedication = document.createElement('div');
    dedication.id = 'final-dedication';
    dedication.innerHTML = '<p>Made with love<br>for my Madno!❤️</p>';
    document.querySelector('#app')?.append(dedication);
  }
  private drawEnd() { this.base('Sammy the Adventurer', 0x312650); this.add.circle(285, 130, 44, 0xfff3bd); this.add.circle(285, 130, 64, 0xfff3bd, .08); for (const [x, y, delay] of [[46, 145, 0], [92, 190, 180], [166, 126, 340], [337, 194, 520], [355, 112, 700], [58, 260, 860]] as const) { const star = this.add.text(x, y, '✦', { fontSize: '13px', color: '#fff3b8' }); this.tweens.add({ targets: star, alpha: .22, scale: 1.45, duration: 720, delay, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); } this.add.rectangle(0, 480, this.scale.width, 65, 0x29484c).setOrigin(0); for (const x of [25, 55, 335, 365]) { this.add.circle(x, 467, 20, 0x386759); this.add.text(x - 7, 452, '✿', { fontSize: '17px', color: '#ed9cae' }); } this.drawAdityaAvatar(222, 495); this.add.text(this.scale.width / 2, 268, 'Some journeys lead to a place.\nThis one led Sammy back to \nAditya.', { align: 'center', fontFamily: 'Playfair Display', fontSize: '23px', color: '#fff7d9', lineSpacing: 11 }).setOrigin(.5); this.add.text(this.scale.width / 2, 375, '♥  Together beneath the moon.  ♥', { align: 'center', fontSize: '12px', color: '#f6c8b0' }).setOrigin(.5); this.target = undefined; }
  private drawFinal() { const id = this.controller.getState().missionId; const m2 = id === 'mission-2'; const m3 = id === 'mission-3'; const m4 = id === 'mission-4';
    if (!m2 && !m3 && !m4) { this.drawRestaurant('spark', false); this.add.rectangle(this.scale.width / 2, 297, 256, 184, 0x31223d, .88).setOrigin(.5).setStrokeStyle(2, 0xf1ca7d); this.add.text(this.scale.width / 2, 237, 'Mission 1 Complete', { fontFamily: 'Playfair Display', fontSize: '24px', color: '#fff0bd' }).setOrigin(.5); this.add.text(this.scale.width / 2, 286, 'The First Spark rests safely\nin Sammy’s handbag.', { align: 'center', fontFamily: 'Playfair Display', fontSize: '18px', color: '#fff8d8', lineSpacing: 7 }).setOrigin(.5); this.add.text(this.scale.width / 2, 342, 'Next: the Bird Sanctuary\nnear the Yamuna bank', { align: 'center', fontSize: '12px', color: '#f9daa0', lineSpacing: 5 }).setOrigin(.5); this.glow(this.scale.width / 2, 500, 'begin Mission 2', 'mission2'); return; }
    this.base(m4 ? 'Mission 4 Complete' : m3 ? 'Mission 3 Complete' : 'Mission 2 Complete', m4 ? 0x24365e : m3 ? 0x5d3558 : 0x70405a); this.add.circle(280, 145, 43, 0xfff2b4); const item = m4 ? 'Lucky Pin' : m3 ? 'photograph' : 'Peacock Feather'; this.add.text(this.scale.width / 2, 255, `The ${item} rests safely\nin Sammy’s handbag.`, { align: 'center', fontFamily: 'Playfair Display', fontSize: '22px', color: '#fff8d8', lineSpacing: 8 }).setOrigin(.5); const next = m4 ? 'Machardutam Park' : m3 ? 'The bowling alley' : 'Pind Baluchi'; this.add.text(this.scale.width / 2, 345, `Next destination:\n${next}`, { align: 'center', fontSize: '13px', color: '#f9daa0', lineSpacing: 7 }).setOrigin(.5); this.glow(this.scale.width / 2, 500, m4 ? 'begin Mission 5' : m3 ? 'begin Mission 4' : 'begin Mission 3', m4 ? 'mission5' : m3 ? 'mission4' : 'mission3'); }
  private inInteractionRange() { return Boolean(this.target && Math.abs(this.player.x - this.target.x) <= this.interactionRange); }
  interact(direct = false) { const t = this.target; const inRange = this.inInteractionRange(); if (!t || (this.controller.isStrictInteractionMode() ? !inRange : (!direct && !inRange))) return; const s = this.controller.getState(); const act = (next: Step, change: Partial<MissionState> = {}, after?: () => void) => { const copy = interactions[t.id]; this.controller.showMessage(copy?.label ?? 'A familiar feeling', copy?.text ?? '', () => { this.controller.advance(next, change); after?.(); }); };
    switch (t.id) {
      case 'handbag': act('bag-picked', { hasHandbag: true }); break;
      case 'phone': act('cab-booked'); break;
      case 'cab': act('restaurant', {}, () => this.controller.showMessage('Masaldani', 'The cab arrives at a restaurant wrapped in warm evening light.')); break;
      case 'door': act('menu-opened'); break;
      case 'menu': act('soup-ordered', { soupStatus: 'ordered' }); break;
      case 'soup': act('soup-finished', { soupStatus: 'finished' }); break;
      case 'spark': act('spark-collected', { artifacts: ['The First Spark'], journalEntries: [{ title: 'The First Spark', body: 'At Masaldani, a golden spark restored a hazy memory of someone special—and birds by a river.' }] }, () => this.controller.showMessage('The First Spark', 'Sammy opens her white handbag. The golden spark settles inside, glowing softly.')); break;
      case 'memory': this.controller.showMessage('A guiding memory', '“A cool breeze… a familiar feeling… and birds beside a river.”\n\nThe next clue points to the Bird Sanctuary near the Yamuna bank.', () => this.controller.advance('memory-complete')); break;
      case 'mission2': this.controller.showMessage('Mission 2 — The Peacock Feather', 'Sammy follows the riverside path as the sunset turns the Yamuna gold.', () => this.controller.advance('sanctuary', { missionId: 'mission-2' })); break;
      case 'birds': act('followed-birds'); break;
      case 'feather': act('feather-collected', { artifacts: [...s.artifacts, 'The Peacock Feather'], journalEntries: [...s.journalEntries, { title: 'The Peacock Feather', body: 'At the Yamuna bird sanctuary, a peacock feather recalled birds, sunset, and a cherished shared moment.' }] }, () => this.controller.showMessage('The Peacock Feather', 'The feather settles beside the First Spark. Sammy’s handbag glows with a new warmth.')); break;
      case 'sanctuary-memory': this.controller.showMessage('A clearer memory', '“I wasn’t alone. We watched the sunset together.”\n\nA feeling of laughter and comfort points her toward Pind Baluchi.', () => this.controller.advance('mission-2-complete')); break;
      case 'mission3': this.controller.showMessage('Mission 3 — The Heart of Flavor', 'Sammy follows the warmth of the memory to Pind Baluchi.', () => this.controller.advance('pind-arrival', { missionId: 'mission-3' })); break;
      case 'pindDoor': act('pind-table'); break;
      case 'chaas': act('chaas-finished', { soupStatus: 'finished' }); break;
      case 'photo': act('photo-collected', { artifacts: [...s.artifacts, 'The Heart of Flavor'], journalEntries: [...s.journalEntries, { title: 'The Heart of Flavor', body: 'At Pind Baluchi, a photograph brought back a playful meal and shared laughter.' }] }, () => this.controller.showMessage('A treasured photograph', 'Sammy slips the little photograph into her handbag. It glows next to the other memories.')); break;
      case 'pind-memory': this.controller.showMessage('A playful clue', '“I remember laughing so much… and rolling a ball down a shining lane.”\n\nThe next memory is waiting at the bowling alley.', () => this.controller.advance('mission-3-complete')); break;
      case 'mission4': this.controller.showMessage('Mission 4 — The Lucky Pin', 'Sammy follows the sound of laughter and falling pins to a bright bowling alley.', () => this.controller.advance('bowling-arrival', { missionId: 'mission-4', bowlingPins: 0 })); break;
      case 'bowlingDoor': act('bowling-roll-1'); break;
      case 'roll': this.playStrike(); break;
      case 'luckyPin': act('bowling-memory', { artifacts: [...s.artifacts, 'The Lucky Pin'], journalEntries: [...s.journalEntries, { title: 'The Lucky Pin', body: 'At the bowling alley, one glowing pin brought back laughter and a moonlit memory.' }] }, () => this.controller.showMessage('The Lucky Pin', 'The final pin shines as Sammy places it gently into her handbag.')); break;
      case 'bowling-memory': this.controller.showMessage('A moonlit clue', '“I know who I am looking for. I only need to remember where.”\n\nMoonlight guides her toward Machardutam Park.', () => this.controller.advance('mission-4-complete')); break;
      case 'mission5': this.controller.showMessage('Mission 5 — The Moon Shard', 'Sammy follows the moon to Machardutam Park, where the final memory is waiting.', () => this.controller.advance('park-arrival', { missionId: 'mission-5' })); break;
      case 'parkPath': act('mosquitoes-cleared'); break;
      case 'mosquitoes': this.shooMosquitoes(); break;
      case 'moon': act('moon-found', { artifacts: [...s.artifacts, 'The Moon Shard'], journalEntries: [...s.journalEntries, { title: 'The Moon Shard', body: 'Under the moon at Machardutam Park, Sammy remembered exactly whom she had been searching for.' }] }, () => this.controller.showMessage('The Moon Shard', 'Moonlight gathers softly in Sammy’s handbag. Every memory now shines together.')); break;
      case 'final-memory': this.controller.showMessage('The final clue', 'The moonlit trail leads onward—toward a quiet castle garden.', () => this.controller.advance('castle-garden')); break;
      case 'castle': this.controller.showMessage('Found you', 'Sammy recognizes him. He reaches out his hand, and she takes it.', () => this.controller.advance('adventure-complete')); break;
    }
  }
}

export const controller = new GameController();
(window as unknown as { controller: GameController }).controller = controller;
