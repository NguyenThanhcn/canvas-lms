/*
 * Copyright (C) 2021 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import DateHelper from '../../../../../shared/datetime/dateHelper'
import {Discussion} from '../../../graphql/Discussion'
import {responsiveQuerySizes} from '../../utils'
import I18n from 'i18n!discussion_posts'

import React from 'react'

import {Alert} from '@instructure/ui-alerts'
import {Text} from '@instructure/ui-text'
import {Responsive} from '@instructure/ui-responsive/lib/Responsive'

export const DiscussionTopicAlertManager = props => {
  return (
    <Responsive
      match="media"
      query={responsiveQuerySizes({mobile: true, desktop: true})}
      props={{
        mobile: {
          alert: {
            textSize: 'small'
          }
        },
        desktop: {
          alert: {
            textSize: 'medium'
          }
        }
      }}
      render={responsiveProps => {
        const applicableAlerts = []

        if (props.discussionTopic.initialPostRequiredForCurrentUser) {
          applicableAlerts.push(
            <Alert key="post-required" renderCloseButtonLabel="Close" margin="0 0 x-small">
              <Text data-testid="post-required" size={responsiveProps?.alert?.textSize}>
                {I18n.t('You must post before seeing replies.')}
              </Text>
            </Alert>
          )
        }

        if (
          props.discussionTopic.permissions?.readAsAdmin &&
          props.discussionTopic.groupSet &&
          props.discussionTopic.assignment?.onlyVisibleToOverrides
        ) {
          applicableAlerts.push(
            <Alert
              key="differentiated-group-topics"
              renderCloseButtonLabel="Close"
              margin="0 0 x-small"
            >
              <Text
                data-testid="differentiated-group-topics"
                size={responsiveProps?.alert?.textSize}
              >
                {I18n.t(
                  'Note: for differentiated group topics, some threads may not have any students assigned.'
                )}
              </Text>
            </Alert>
          )
        }

        if (
          props.discussionTopic.isAnnouncement &&
          props.discussionTopic.delayedPostAt &&
          Date.parse(props.discussionTopic.delayedPostAt) > Date.now()
        ) {
          applicableAlerts.push(
            <Alert key="delayed-until" renderCloseButtonLabel="Close" margin="0 0 x-small">
              <Text data-testid="delayed-until" size={responsiveProps?.alert?.textSize}>
                {I18n.t('This announcement will not be visible until %{delayedPostAt}.', {
                  delayedPostAt: DateHelper.formatDatetimeForDiscussions(
                    props.discussionTopic.delayedPostAt
                  )
                })}
              </Text>
            </Alert>
          )
        }

        if (!props.discussionTopic.availableForUser) {
          applicableAlerts.push(
            <Alert key="locked-for-user" renderCloseButtonLabel="Close" margin="0 0 x-small">
              <Text data-testid="locked-for-user" size={responsiveProps?.alert?.textSize}>
                {I18n.t('This topic will be available %{delayedPostAt}.', {
                  delayedPostAt: props.discussionTopic.assignment
                    ? DateHelper.formatDatetimeForDiscussions(
                        props.discussionTopic.assignment.unlockAt
                      )
                    : DateHelper.formatDatetimeForDiscussions(props.discussionTopic.delayedPostAt)
                })}
              </Text>
            </Alert>
          )
        }

        if (props.discussionTopic.anonymousState) {
          applicableAlerts.push(
            <Alert key="anon-conversation" variant="info" margin="0 0 x-small">
              <Text data-testid="anon-conversation" size={responsiveProps?.alert?.textSize}>
                {/* teachers, tas and designers are assigned the teacher roles in current_user_roles */}
                {ENV.current_user_roles?.includes('teacher')
                  ? I18n.t(
                      'This is an anonymous Discussion. Though student names and profile pictures will be hidden, your name and profile picture will be visible to all course members.'
                    )
                  : I18n.t(
                      'This is an anonymous Discussion, Your name and profile picture will be hidden from other course members.'
                    )}
              </Text>
            </Alert>
          )
        }
        return applicableAlerts
      }}
    />
  )
}

DiscussionTopicAlertManager.propTypes = {
  discussionTopic: Discussion.shape.isRequired
}
