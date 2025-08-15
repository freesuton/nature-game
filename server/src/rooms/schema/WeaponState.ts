import { Schema, type } from '@colyseus/schema';

export class WeaponState extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("boolean") isPickedUp: boolean = false;
  @type("string") weaponType: string = "";
}
