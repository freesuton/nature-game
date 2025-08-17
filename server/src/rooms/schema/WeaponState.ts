import { Schema, type } from '@colyseus/schema';

export class WeaponState extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("boolean") isPickedUp: boolean = false;
  @type("string") weaponType: string = "";
  @type("string") weaponName: string = "";
  @type("number") attackRange: number = 50;

  constructor(weaponType: string = "weapon") {
    super();
    this.weaponType = weaponType;
    
    // Initialize weapon properties based on type
    switch (weaponType) {
      case "gun":
        this.weaponName = "Pistol";
        this.attackRange = 200;
        break;
      case "sword":
        this.weaponName = "Blade";
        this.attackRange = 60;
        break;
      default:
        this.weaponName = "Tool";
        this.attackRange = 50;
        break;
    }
  }
}
