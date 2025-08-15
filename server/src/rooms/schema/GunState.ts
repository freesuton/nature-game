import { type } from '@colyseus/schema';
import { WeaponState } from './WeaponState';

export class GunState extends WeaponState {
  constructor() {
    super();
    this.weaponType = "gun";
  }
}