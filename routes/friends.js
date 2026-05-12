"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
// In-memory store for demo
const friendsByTeam = {};
// Get friends for a team
router.get('/:teamId', (req, res) => {
    const { teamId } = req.params;
    res.json(friendsByTeam[teamId] || []);
});
// Add/update friends and tips for a team
router.post('/:teamId', (req, res) => {
    const { teamId } = req.params;
    const { friends } = req.body;
    if (!Array.isArray(friends))
        return res.status(400).json({ error: 'Invalid friends' });
    friendsByTeam[teamId] = friends;
    res.json({ ok: true });
});
exports.default = router;
