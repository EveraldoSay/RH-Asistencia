console.log('Current Date:', new Date().toString());
console.log('Timezone Offset:', new Date().getTimezoneOffset());
const d = new Date('2025-12-06');
console.log('Date:', d.toISOString());
console.log('Day (Local):', d.getDay());
console.log('Day (UTC):', d.getUTCDay());
