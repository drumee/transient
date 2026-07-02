/**
 * PMF rating survey endpoints.
 *   get_state → { done, snooze_until } — gates the FE popup/timer.
 *   submit    → upsert score(+answers JSON) into yp.survey_response,
 *               set profile.survey.done=1 (never ask again, cross-device).
 *   dismiss   → profile.survey.snooze_until = now + 7 days ("remind later").
 */
const { toArray } = require('@drumee/server-essentials');
const { Entity } = require('@drumee/server-core');

const SNOOZE_DAYS = 7;

class __survey extends Entity {

  /** Read + parse the caller's drumate profile JSON. */
  async _profile() {
    const row = toArray(await this.yp.await_query(
      `SELECT profile FROM drumate WHERE id=?`, this.uid
    ))[0];
    let profile = {};
    if (row && row.profile) {
      try { profile = (typeof row.profile === 'string' ? JSON.parse(row.profile) : row.profile) || {}; }
      catch (_) { profile = {}; }
    }
    return profile;
  }

  /**
   * Merge a patch into profile.survey and write the WHOLE profile back with a
   * plain UPDATE — drumate_update_profile rebuilds from a key whitelist and
   * would silently drop the new `survey` key (see google_drive.ack_result).
   */
  async _mergeSurveyFlag(patch) {
    const profile = await this._profile();
    profile.survey = Object.assign({}, profile.survey, patch);
    await this.yp.await_query(
      `UPDATE drumate SET profile=? WHERE id=?`, JSON.stringify(profile), this.uid
    );
    return profile.survey;
  }

  async get_state() {
    const profile = await this._profile();
    const survey = profile.survey || {};
    let done = survey.done ? 1 : 0;
    if (!done) {
      // Defensive: a response row means done even if the profile write failed.
      const row = toArray(await this.yp.await_query(
        `SELECT id FROM survey_response WHERE uid=?`, this.uid
      ))[0];
      if (row) done = 1;
    }
    this.output.data({ done, snooze_until: Number(survey.snooze_until) || 0 });
  }

  async submit() {
    const score = parseInt(this.input.need('score'), 10) || 0;
    // Numeric proc params must never receive null ('' is rejected by strict
    // INT params) — score is always an int here; answers is TEXT so '' is fine.
    const answers = this.input.use('answers', '') || '';
    const row = await this.yp.await_proc('survey_upsert', this.uid, score, answers);
    await this._mergeSurveyFlag({ done: 1 });
    this.output.data({ ok: true, response: toArray(row)[0] || null });
  }

  async dismiss() {
    const snooze_until = Math.floor(Date.now() / 1000) + SNOOZE_DAYS * 86400;
    await this._mergeSurveyFlag({ snooze_until });
    this.output.data({ ok: true, snooze_until });
  }
}

module.exports = __survey;
