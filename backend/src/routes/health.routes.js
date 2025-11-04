const router = require('express').Router();
router.get('/', (req, res) => res.json({ ok: true, ts: new Date() }));
module.exports = router;
