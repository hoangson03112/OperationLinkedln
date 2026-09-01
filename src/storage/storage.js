"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
exports.getState = getState;
exports.updateState = updateState;
exports.getCandidates = getCandidates;
exports.saveCandidate = saveCandidate;
exports.getInvitations = getInvitations;
exports.saveInvitation = saveInvitation;
var DEFAULT_SETTINGS = {
    connectEnabled: false,
    withdrawEnabled: false,
    maxActionsPerRun: 20,
};
var DEFAULT_STATE = {
    connectStatus: "idle",
    withdrawStatus: "idle",
    connectCount: 0,
    withdrawCount: 0,
};
function getSettings() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, chrome.storage.local.get("settings")];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, __assign(__assign({}, DEFAULT_SETTINGS), ((_a = result.settings) !== null && _a !== void 0 ? _a : {}))];
            }
        });
    });
}
function updateSettings(settings) {
    return __awaiter(this, void 0, void 0, function () {
        var current;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getSettings()];
                case 1:
                    current = _a.sent();
                    return [4 /*yield*/, chrome.storage.local.set({
                            settings: __assign(__assign({}, current), settings),
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getState() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, chrome.storage.local.get("state")];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, __assign(__assign({}, DEFAULT_STATE), ((_a = result.state) !== null && _a !== void 0 ? _a : {}))];
            }
        });
    });
}
function updateState(state) {
    return __awaiter(this, void 0, void 0, function () {
        var current;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getState()];
                case 1:
                    current = _a.sent();
                    return [4 /*yield*/, chrome.storage.local.set({
                            state: __assign(__assign({}, current), state),
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getCandidates() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, chrome.storage.local.get("candidates")];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, (_a = result.candidates) !== null && _a !== void 0 ? _a : []];
            }
        });
    });
}
function saveCandidate(candidate) {
    return __awaiter(this, void 0, void 0, function () {
        var candidates, exists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getCandidates()];
                case 1:
                    candidates = _a.sent();
                    exists = candidates.some(function (item) { return item.profileUrl === candidate.profileUrl; });
                    if (exists) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, chrome.storage.local.set({
                            candidates: __spreadArray(__spreadArray([], candidates, true), [candidate], false),
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getInvitations() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, chrome.storage.local.get("invitations")];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, (_a = result.invitations) !== null && _a !== void 0 ? _a : []];
            }
        });
    });
}
function saveInvitation(invitation) {
    return __awaiter(this, void 0, void 0, function () {
        var invitations, exists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getInvitations()];
                case 1:
                    invitations = _a.sent();
                    exists = invitations.some(function (item) { return item.id === invitation.id; });
                    if (exists) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, chrome.storage.local.set({
                            invitations: __spreadArray(__spreadArray([], invitations, true), [invitation], false),
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
