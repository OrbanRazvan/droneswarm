"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameController = void 0;
const common_1 = require("@nestjs/common");
let GameController = class GameController {
    state() {
        return {
            server: 'EU #3',
            playing: 52,
            player: { username: 'You', mass: 1250, drones: 19, skin: 'cyan' },
            abilities: ['speed', 'split', 'shield', 'magnet']
        };
    }
};
exports.GameController = GameController;
__decorate([
    (0, common_1.Get)('state'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GameController.prototype, "state", null);
exports.GameController = GameController = __decorate([
    (0, common_1.Controller)('game')
], GameController);
//# sourceMappingURL=game.controller.js.map