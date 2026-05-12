"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = get;
exports.set = set;
const node_cache_1 = __importDefault(require("node-cache"));
const cache = new node_cache_1.default({ stdTTL: 60 * 60 * 24 }); // 24-hour TTL
function get(key) {
    return cache.get(key);
}
function set(key, value) {
    cache.set(key, value);
}
