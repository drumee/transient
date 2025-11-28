// File: service/mfs_activity.js
// Purpose: MFS activity notification service - handle read/unread status

const { Entity } = require('@drumee/server-core');
const { Attr, toArray } = require('@drumee/server-essentials');

class MfsActivity extends Entity {

  initialize(opt) {
    super.initialize(opt);
    this.debug('[MFS_ACTIVITY] Service initialized');
  }

  /**
   * Get count of unread notifications
   * Endpoint: GET /mfs_activity.get_unread_count
   * 
   * Output:
   * - unread_count: Number of unread notifications
   */
  async get_unread_count() {
    try {
      const userId = this.uid;

      if (!userId) {
        return this.output.data({
          status: 'error',
          error: 'not_authenticated',
          message: 'User not authenticated'
        });
      }

      this.debug(`[MFS_ACTIVITY] Getting unread count for user: ${userId}`);

      const result = await this.db.await_proc('mfs_get_unread_count', userId);
      const data = toArray(result)[0] || { unread_count: 0 };

      return this.output.data({
        status: 'ok',
        unread_count: data.unread_count
      });

    } catch (error) {
      this.warn('[MFS_ACTIVITY] Error in get_unread_count:', error.message);
      return this.output.data({
        status: 'error',
        error: 'internal_error',
        message: error.message
      });
    }
  }

  /**
   * Mark all notifications as read
   * Endpoint: POST /mfs_activity.mark_all_read
   * 
   * Input:
   * - last_id (optional): Specific changelog ID to mark as last read
   *                       If not provided, will use the latest changelog ID
   * 
   * Output:
   * - status: ok or error
   * - last_read_id: The ID that was marked as last read
   */
  async mark_all_read() {
    try {
      const userId = this.uid;

      if (!userId) {
        return this.output.data({
          status: 'error',
          error: 'not_authenticated',
          message: 'User not authenticated'
        });
      }

      // Get last_id from input, or fetch latest from yp.mfs_changelog
      let lastId = parseInt(this.input.get('last_id'));

      if (!lastId || lastId <= 0) {
        const latestResult = await this.yp.await_query(
          'SELECT MAX(id) as max_id FROM mfs_changelog'
        );
        const latest = toArray(latestResult)[0];
        lastId = latest?.max_id || 0;
      }

      this.debug(`[MFS_ACTIVITY] Marking all read for user ${userId}, last_id: ${lastId}`);

      const result = await this.db.await_proc('mfs_mark_all_read', userId, lastId);
      const data = toArray(result)[0];

      if (data && data.status === 'ok') {
        return this.output.data({
          status: 'ok',
          message: 'All notifications marked as read',
          last_read_id: data.last_read_id,
          updated_at: data.mtime
        });
      } else {
        throw new Error('Failed to update acknowledgement');
      }

    } catch (error) {
      this.warn('[MFS_ACTIVITY] Error in mark_all_read:', error.message);
      return this.output.data({
        status: 'error',
        error: 'internal_error',
        message: error.message
      });
    }
  }

  /**
   * Get activity feed with pagination
   * Endpoint: GET /mfs_activity.get_feed
   * 
   * Input:
   * - limit (optional): Number of items per page (default: 20)
   * - offset (optional): Offset for pagination (default: 0)
   * 
   * Output:
   * - items: Array of activity items with read status
   * - pagination: { limit, offset, has_more }
   */
  async get_feed() {
    try {
      const userId = this.uid;

      if (!userId) {
        return this.output.data({
          status: 'error',
          error: 'not_authenticated',
          message: 'User not authenticated'
        });
      }

      const limit = parseInt(this.input.get('limit')) || 20;
      const offset = parseInt(this.input.get('offset')) || 0;

      if (limit <= 0 || limit > 100) {
        return this.output.data({
          status: 'error',
          error: 'invalid_limit',
          message: 'Limit must be between 1 and 100'
        });
      }

      if (offset < 0) {
        return this.output.data({
          status: 'error',
          error: 'invalid_offset',
          message: 'Offset must be non-negative'
        });
      }

      this.debug(`[MFS_ACTIVITY] Getting feed for user ${userId}, limit: ${limit}, offset: ${offset}`);

      const result = await this.db.await_proc('mfs_get_activity_feed', userId, limit, offset);
      const items = toArray(result);

      const hasMore = items.length === limit;

      return this.output.data({
        status: 'ok',
        items: items,
        pagination: {
          limit: limit,
          offset: offset,
          count: items.length,
          has_more: hasMore
        }
      });

    } catch (error) {
      this.warn('[MFS_ACTIVITY] Error in get_feed:', error.message);
      return this.output.data({
        status: 'error',
        error: 'internal_error',
        message: error.message
      });
    }
  }

  /**
   * Get last read information
   * Endpoint: GET /mfs_activity.get_last_read
   * 
   * Output:
   * - last_read_id: Last changelog ID marked as read
   * - updated_at: Timestamp of last update
   */
  async get_last_read() {
    try {
      const userId = this.uid;

      if (!userId) {
        return this.output.data({
          status: 'error',
          error: 'not_authenticated',
          message: 'User not authenticated'
        });
      }

      this.debug(`[MFS_ACTIVITY] Getting last read info for user: ${userId}`);

      const result = await this.db.await_query(
        'SELECT user_id, last_read_id, mtime FROM mfs_ack WHERE user_id = ?',
        userId
      );

      const data = toArray(result)[0];

      if (data) {
        return this.output.data({
          status: 'ok',
          last_read_id: data.last_read_id,
          updated_at: data.mtime
        });
      } else {
        return this.output.data({
          status: 'ok',
          last_read_id: 0,
          updated_at: 0
        });
      }

    } catch (error) {
      this.warn('[MFS_ACTIVITY] Error in get_last_read:', error.message);
      return this.output.data({
        status: 'error',
        error: 'internal_error',
        message: error.message
      });
    }
  }

}

module.exports = MfsActivity;