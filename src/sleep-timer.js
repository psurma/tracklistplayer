import { formatTime } from './helpers.js';
import { audio, btnSleep, sleepPopover, sleepActive, sleepRemaining, sleepCancelBtn } from './dom-refs.js';

let _sleepInterval = null;
let _sleepSecsLeft = 0;

function startSleepTimer(mins) {
  clearSleepTimer();
  _sleepSecsLeft = mins * 60;
  btnSleep.classList.add('active');
  sleepActive.classList.remove('hidden');
  _sleepInterval = setInterval(() => {
    _sleepSecsLeft--;
    sleepRemaining.textContent = formatTime(_sleepSecsLeft);
    if (_sleepSecsLeft <= 0) {
      audio.pause();
      clearSleepTimer();
    }
  }, 1000);
  sleepRemaining.textContent = formatTime(_sleepSecsLeft);
  sleepPopover.classList.add('hidden');
}

function clearSleepTimer() {
  if (_sleepInterval) clearInterval(_sleepInterval);
  _sleepInterval = null;
  _sleepSecsLeft = 0;
  btnSleep.classList.remove('active');
  sleepActive.classList.add('hidden');
}

// Event listeners
btnSleep.addEventListener('click', () => {
  sleepPopover.classList.toggle('hidden');
});
sleepPopover.querySelector('.sleep-presets').addEventListener('click', (e) => {
  const mins = e.target.dataset?.mins;
  if (mins) startSleepTimer(parseInt(mins, 10));
});
sleepCancelBtn.addEventListener('click', () => {
  clearSleepTimer();
  sleepPopover.classList.add('hidden');
});

export { startSleepTimer, clearSleepTimer };
