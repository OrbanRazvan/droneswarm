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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchResultController = void 0;
const common_1 = require("@nestjs/common");
const match_result_service_1 = require("./match-result.service");
let MatchResultController = class MatchResultController {
    constructor(matchResultService) {
        this.matchResultService = matchResultService;
    }
    saveBattleRoyaleResult(body) {
        return this.matchResultService.saveBattleRoyaleResult(body);
    }
    getHistory(userId) {
        return this.matchResultService.getHistoryForUser(Number(userId));
    }
};
exports.MatchResultController = MatchResultController;
__decorate([
    (0, common_1.Post)('battle-royale'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MatchResultController.prototype, "saveBattleRoyaleResult", null);
__decorate([
    (0, common_1.Get)('battle-royale/history/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MatchResultController.prototype, "getHistory", null);
exports.MatchResultController = MatchResultController = __decorate([
    (0, common_1.Controller)('matches'),
    __metadata("design:paramtypes", [match_result_service_1.MatchResultService])
], MatchResultController);
//# sourceMappingURL=match-result.controller.js.map