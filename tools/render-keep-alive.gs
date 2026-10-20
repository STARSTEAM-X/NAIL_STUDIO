/**
 * Keep the NAIL_STUDIO Render service awake with a Google Apps Script
 * time-driven trigger. Render free web services spin down after 15 minutes
 * without traffic, so a ping every 10 minutes keeps the frontend warm.
 *
 * Setup:
 * 1. Open https://script.google.com and create a new project.
 * 2. Paste this file into Code.gs.
 * 3. Run installKeepAliveTrigger() once and grant permissions.
 * 4. Check Executions in Apps Script to confirm successful runs.
 *
 * Note: Render free instance hours (750 h/month) are shared by the whole
 * workspace. One service awake 24/7 uses ~744 h, so adding a second
 * always-on free service will run out of hours mid-month.
 */

const KEEP_ALIVE_URLS = [
  // Web + API are served by the same service; the health route is cheap and
  // wakes the whole process, the root also checks the SPA is being served.
  'https://nail-studio-nkmi.onrender.com/api/v1/health',
  'https://nail-studio-nkmi.onrender.com/'
  // 'https://nail-studio-mcp.onrender.com/health' // uncomment only if hours allow
];

const KEEP_ALIVE_HANDLER = 'keepAlive';
const KEEP_ALIVE_EVERY_MINUTES = 10; // Apps Script allows 1, 5, 10, 15 or 30

/**
 * Pings every configured URL and writes the status to the execution log.
 * This function is called automatically after installing the trigger.
 */
function keepAlive() {
  const lock = LockService.getScriptLock();

  // Prevent overlapping runs if a service is slow to wake up.
  if (!lock.tryLock(1000)) {
    console.log('Skipped: another keepAlive execution is still running.');
    return;
  }

  try {
    const requests = KEEP_ALIVE_URLS.map(function (url) {
      return {
        url: url,
        method: 'get',
        followRedirects: true,
        muteHttpExceptions: true,
        validateHttpsCertificates: true,
        headers: {
          'Cache-Control': 'no-cache',
          'User-Agent': 'Google-Apps-Script-Render-Keep-Alive/1.0'
        }
      };
    });

    const responses = UrlFetchApp.fetchAll(requests);
    const checkedAt = new Date().toISOString();

    responses.forEach(function (response, index) {
      const status = response.getResponseCode();

      console.log(JSON.stringify({
        checkedAt: checkedAt,
        url: KEEP_ALIVE_URLS[index],
        status: status,
        ok: status >= 200 && status < 400,
        bodyPreview: response.getContentText().slice(0, 200)
      }));
    });
  } catch (error) {
    // fetchAll throws on DNS/timeout errors; log and let the next run retry.
    console.error('keepAlive failed: ' + error);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Run once manually. Removes old keepAlive triggers, creates one trigger,
 * then performs an immediate test request.
 */
function installKeepAliveTrigger() {
  removeKeepAliveTriggers_();

  ScriptApp.newTrigger(KEEP_ALIVE_HANDLER)
    .timeBased()
    .everyMinutes(KEEP_ALIVE_EVERY_MINUTES)
    .create();

  keepAlive();
  console.log('Installed keepAlive trigger: every ' + KEEP_ALIVE_EVERY_MINUTES + ' minutes.');
}

/**
 * Run manually if you want to stop all automatic keep-alive requests.
 */
function uninstallKeepAliveTrigger() {
  const removed = removeKeepAliveTriggers_();
  console.log('Removed ' + removed + ' keepAlive trigger(s).');
}

function removeKeepAliveTriggers_() {
  let removed = 0;

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === KEEP_ALIVE_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
      removed += 1;
    }
  });

  return removed;
}
