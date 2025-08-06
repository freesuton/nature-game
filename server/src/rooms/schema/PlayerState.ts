import { Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type("number")
  x: number = 100;

  @type("number")
  y: number = 200; // Will be set dynamically when player joins

  @type("number")
  velocityX: number = 0;

  @type("number")
  velocityY: number = 0;

  @type("boolean")
  onGround: boolean = true;

  @type("number")
  facingDirection: number = 1; // 1 for right, -1 for left
}