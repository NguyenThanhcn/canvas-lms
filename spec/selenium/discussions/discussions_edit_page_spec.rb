# frozen_string_literal: true

#
# Copyright (C) 2014 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.

require_relative "../helpers/discussions_common"
require_relative "../common"

describe "discussions" do
  include_context "in-process server selenium tests"
  include DiscussionsCommon

  let(:course) { course_model.tap(&:offer!) }
  let(:teacher) { teacher_in_course(course: course, name: "teacher", active_all: true).user }
  let(:teacher_topic) { course.discussion_topics.create!(user: teacher, title: "teacher topic title", message: "teacher topic message") }
  let(:assignment_group) { course.assignment_groups.create!(name: "assignment group") }
  let(:group_category) { course.group_categories.create!(name: "group category") }
  let(:assignment) do
    course.assignments.create!(
      name: "assignment",
      # submission_types: 'discussion_topic',
      assignment_group: assignment_group
    )
  end
  let(:assignment_topic) do
    course.discussion_topics.create!(user: teacher,
                                     title: "assignment topic title",
                                     message: "assignment topic message",
                                     assignment: assignment)
  end

  context "on the edit page" do
    let(:url) { "/courses/#{course.id}/discussion_topics/#{topic.id}/edit" }

    context "as a teacher" do
      let(:topic) { teacher_topic }

      before do
        user_session(teacher)
        stub_rcs_config
      end

      context "graded" do
        let(:topic) { assignment_topic }

        it "allows editing the assignment group", priority: "1" do
          assign_group_2 = course.assignment_groups.create!(name: "Group 2")

          get url
          wait = Selenium::WebDriver::Wait.new(timeout: 5)
          wait.until { f("#assignment_group_id").present? }
          click_option("#assignment_group_id", assign_group_2.name)

          expect_new_page_load { f(".form-actions button[type=submit]").click }
          expect(topic.reload.assignment.assignment_group_id).to eq assign_group_2.id
        end

        it "allows editing the grading type", priority: "1" do
          get url
          wait = Selenium::WebDriver::Wait.new(timeout: 5)
          wait.until { f("#assignment_grading_type").present? }
          click_option("#assignment_grading_type", "Letter Grade")

          expect_new_page_load { f(".form-actions button[type=submit]").click }
          expect(topic.reload.assignment.grading_type).to eq "letter_grade"
        end

        it "allows editing the group category", priority: "1" do
          group_cat = course.group_categories.create!(name: "Groupies")
          get url

          f("#has_group_category").click
          click_option("#assignment_group_category_id", group_cat.name)

          expect_new_page_load { f(".form-actions button[type=submit]").click }
          expect(topic.reload.group_category_id).to eq group_cat.id
        end

        it "allows editing the peer review", priority: "1" do
          get url

          f("#assignment_peer_reviews").click

          expect_new_page_load { f(".form-actions button[type=submit]").click }
          expect(topic.reload.assignment.peer_reviews).to eq true
        end

        it "allows editing the due dates", priority: "1" do
          get url
          wait_for_tiny(f("textarea[name=message]"))

          due_at = Time.zone.now + 3.days
          unlock_at = Time.zone.now + 2.days
          lock_at = Time.zone.now + 4.days

          # set due_at, lock_at, unlock_at
          replace_content(f(".date_field[data-date-type='due_at']"), format_date_for_view(due_at), tab_out: true)
          replace_content(f(".date_field[data-date-type='unlock_at']"), format_date_for_view(unlock_at), tab_out: true)
          replace_content(f(".date_field[data-date-type='lock_at']"), format_date_for_view(lock_at), tab_out: true)
          wait_for_ajaximations

          expect_new_page_load { f(".form-actions button[type=submit]").click }

          a = DiscussionTopic.last.assignment
          expect(a.due_at.to_date).to eq due_at.to_date
          expect(a.unlock_at.to_date).to eq unlock_at.to_date
          expect(a.lock_at.to_date).to eq lock_at.to_date
        end

        it "adds an attachment to a graded topic", priority: "1" do
          get url
          wait_for_tiny(f("textarea[name=message]"))

          add_attachment_and_validate do
            # should correctly save changes to the assignment
            set_value f("#discussion_topic_assignment_points_possible"), "123"
          end
          assignment.reload
          expect(assignment.points_possible).to eq 123
        end

        it "returns focus to add attachment when removed" do
          get url
          add_attachment_and_validate
          get url
          f(".removeAttachment").click
          wait_for_ajaximations
          check_element_has_focus(f("input[name=attachment]"))
        end

        it "warns user when leaving page unsaved", priority: "1" do
          skip_if_safari(:alert)
          title = "new title"
          get url
          wait_for_tiny(f("textarea[name=message]"))

          replace_content(f("input[name=title]"), title)
          fln("Home").click

          expect(alert_present?).to be_truthy

          driver.switch_to.alert.dismiss
        end
      end

      context "with a group attached" do
        let(:graded_topic) { assignment_topic }

        before do
          @gc = GroupCategory.create(name: "Sharks", context: @course)
          @student = student_in_course(course: @course, active_all: true).user
          group = @course.groups.create!(group_category: @gc)
          group.users << @student
        end

        it "group discussions with entries should lock and display the group name", priority: "1" do
          topic.group_category = @gc
          topic.save!
          topic.child_topics[0].reply_from({ user: @student, text: "I feel pretty" })
          @gc.destroy
          get url

          expect(f("#assignment_group_category_id")).to be_disabled
          expect(get_value("#assignment_group_category_id")).to eq topic.group_category.id.to_s
        end

        it "prompts for creating a new group category if original group is deleted with no submissions", priority: "1" do
          topic.group_category = @gc
          topic.save!
          @gc.destroy
          get url
          wait_for_ajaximations
          expect(f("#assignment_group_category_id")).not_to be_displayed
        end

        context "graded" do
          let(:topic) { assignment_topic }

          it "locks and display the group name", priority: "1" do
            topic.group_category = @gc
            topic.save!
            topic.reply_from({ user: @student, text: "I feel pretty" })
            @gc.destroy
            get url

            expect(f("#assignment_group_category_id")).to be_disabled
            expect(get_value("#assignment_group_category_id")).to eq topic.group_category.id.to_s
          end
        end
      end

      it "saves and display all changes", priority: "2" do
        course.require_assignment_group

        confirm(:off)
        toggle(:on)
        confirm(:on)
      end

      it "shows correct date when saving" do
        Timecop.freeze do
          topic.lock_at = Time.zone.now - 5.days
          topic.save!
          teacher.time_zone = "Hawaii"
          teacher.save!
          get url
          f(".form-actions button[type=submit]").click
          get url
          expect(topic.reload.lock_at).to eq (Time.zone.now - 5.days).beginning_of_minute
        end
      end

      it "toggles checkboxes when clicking their labels", priority: "1" do
        get url

        expect(is_checked("input[type=checkbox][name=threaded]")).not_to be_truthy
        driver.execute_script(%{$('input[type=checkbox][name=threaded]').parent().click()})
        expect(is_checked("input[type=checkbox][name=threaded]")).to be_truthy
      end

      context "locking" do
        it "sets as active when removing existing delayed_post_at and lock_at dates", priority: "1" do
          topic.delayed_post_at = 10.days.ago
          topic.lock_at         = 5.days.ago
          topic.locked          = true
          topic.save!

          get url
          wait_for_tiny(f("textarea[name=message]"))

          expect(f('input[type=text][name="delayed_post_at"]')).to be_displayed

          f('input[type=text][name="delayed_post_at"]').clear
          f('input[type=text][name="lock_at"]').clear

          expect_new_page_load { f(".form-actions button[type=submit]").click }

          topic.reload
          expect(topic.delayed_post_at).to be_nil
          expect(topic.lock_at).to be_nil
          expect(topic.active?).to be_truthy
          expect(topic.locked?).to be_falsey
        end

        it "is locked when delayed_post_at and lock_at are in past", priority: "2" do
          topic.delayed_post_at = nil
          topic.lock_at         = nil
          topic.workflow_state  = "active"
          topic.save!

          get url
          wait_for_tiny(f("textarea[name=message]"))

          delayed_post_at = Time.zone.now - 10.days
          lock_at = Time.zone.now - 5.days

          replace_content(f('input[type=text][name="delayed_post_at"]'), format_date_for_view(delayed_post_at), tab_out: true)
          replace_content(f('input[type=text][name="lock_at"]'), format_date_for_view(lock_at), tab_out: true)

          expect_new_page_load { f(".form-actions button[type=submit]").click }
          wait_for_ajaximations

          topic.reload
          expect(topic.delayed_post_at.to_date).to eq delayed_post_at.to_date
          expect(topic.lock_at.to_date).to eq lock_at.to_date
          expect(topic.locked?).to be_truthy
        end

        it "sets workflow to active when delayed_post_at in past and lock_at in future", priority: "2" do
          topic.delayed_post_at = 5.days.from_now
          topic.lock_at         = 10.days.from_now
          topic.workflow_state  = "active"
          topic.locked          = false
          topic.save!

          get url
          wait_for_tiny(f("textarea[name=message]"))

          delayed_post_at = Time.zone.now - 5.days

          replace_content(f('input[type=text][name="delayed_post_at"]'), format_date_for_view(delayed_post_at), tab_out: true)

          expect_new_page_load { f(".form-actions button[type=submit]").click }
          wait_for_ajaximations

          topic.reload
          expect(topic.delayed_post_at.to_date).to eq delayed_post_at.to_date
          expect(topic.active?).to be_truthy
          expect(topic.locked?).to be_falsey
        end
      end

      context "usage rights" do
        before do
          course.root_account.enable_feature!(:usage_rights_discussion_topics)
          course.update!(usage_rights_required: true)
        end

        it "validates that usage rights are set" do
          get url
          _filename, fullpath, _data = get_file("testfile5.zip")
          f("input[name=attachment]").send_keys(fullpath)
          type_in_tiny("textarea[name=message]", "file attachment discussion")
          f("#edit_discussion_form_buttons .btn-primary[type=submit]").click
          wait_for_ajaximations
          error_box = f("div[role='alert'] .error_text")
          expect(error_box.text).to eq "You must set usage rights"
        end

        it "sets usage rights on file attachment" do
          get url
          _filename, fullpath, _data = get_file("testfile1.txt")
          f("input[name=attachment]").send_keys(fullpath)
          f("#usage_rights_control button").click
          click_option(".UsageRightsSelectBox__container select", "own_copyright", :value)
          f(".UsageRightsDialog__Footer-Actions button[type='submit']").click
          expect_new_page_load { f(".form-actions button[type=submit]").click }
          expect(topic.reload.attachment.usage_rights).not_to be_nil
        end

        it "displays usage rights on file attachment" do
          usage_rights = @course.usage_rights.create!(
            legal_copyright: "(C) 2012 Initrode",
            use_justification: "own_copyright"
          )
          file = @course.attachments.create!(
            display_name: "hey.txt",
            uploaded_data: default_uploaded_data,
            usage_rights: usage_rights
          )
          file.usage_rights
          topic.attachment = file
          topic.save!

          get url
          expect(element_exists?("#usage_rights_control i.icon-files-copyright")).to eq(true)
        end
      end
    end
  end
end
