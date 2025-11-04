module.exports = {
  async getCapabilities() {
    return {
      AcsCfg: { version: '4.6.2', face: true, fingerprint: false, maskDetect: true },
      deviceName: 'Demo DS-K1T671TM-3XF'
    };
  },
  async testConnection() { return { ok: true, device: 'mock' }; },
  async pullEvents() {
    const now = new Date();
    return [
      { device_person_id: 'EMP-001', event_time: now, result: 'SUCCESS', direction: 'IN', temperature: 36.4 },
      { device_person_id: 'EMP-002', event_time: now, result: 'SUCCESS', direction: 'IN', temperature: 36.6 }
    ];
  }
};