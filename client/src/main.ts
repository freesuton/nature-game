import 'phaser';
import { Game } from 'phaser';
import { GameConfig } from './config/game';

window.addEventListener('load', () => {
  new Game(GameConfig);
});