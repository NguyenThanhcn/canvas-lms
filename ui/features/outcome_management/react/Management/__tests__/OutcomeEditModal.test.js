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

import React from 'react'
import {render as realRender, fireEvent, act} from '@testing-library/react'
import {MockedProvider} from '@apollo/react-testing'
import {within} from '@testing-library/dom'
import OutcomeEditModal from '../OutcomeEditModal'
import * as FlashAlert from '@canvas/alerts/react/FlashAlert'
import OutcomesContext from '@canvas/outcomes/react/contexts/OutcomesContext'
import {
  updateLearningOutcomeMocks,
  setFriendlyDescriptionOutcomeMock
} from '@canvas/outcomes/mocks/Management'

jest.useFakeTimers()

describe('OutcomeEditModal', () => {
  let onCloseHandlerMock
  let showFlashAlertSpy
  let onEditLearningOutcomeHandlerMock

  const outcome = {
    _id: '1',
    title: 'Outcome',
    description: 'Outcome description',
    displayName: 'Friendly outcome name',
    contextType: 'Account',
    contextId: '1'
  }

  const defaultProps = (props = {}) => ({
    outcome,
    isOpen: true,
    onCloseHandler: onCloseHandlerMock,
    onEditLearningOutcomeHandler: onEditLearningOutcomeHandlerMock,
    ...props
  })

  beforeEach(() => {
    onCloseHandlerMock = jest.fn()
    onEditLearningOutcomeHandlerMock = jest.fn()
    showFlashAlertSpy = jest.spyOn(FlashAlert, 'showFlashAlert')
  })

  const renderWithProvider = ({
    overrides = {},
    failResponse = false,
    failMutation = false.message,
    env = {
      contextType: 'Account',
      contextId: '1',
      friendlyDescriptionFF: true,
      individualOutcomeRatingAndCalculationFF: false
    },
    mockOverrides = []
  } = {}) => {
    const mocks = [
      setFriendlyDescriptionOutcomeMock({
        failResponse,
        failMutation
      }),
      ...updateLearningOutcomeMocks({description: outcome.description}),
      ...mockOverrides
    ]

    return render(
      <OutcomesContext.Provider value={{env}}>
        <MockedProvider mocks={mocks}>
          <OutcomeEditModal {...defaultProps()} {...overrides} />
        </MockedProvider>
      </OutcomesContext.Provider>
    )
  }

  const render = (children, mocks = []) => {
    return realRender(
      <MockedProvider addTypename={false} mocks={mocks}>
        {children}
      </MockedProvider>
    )
  }

  it('shows modal if isOpen prop true', () => {
    const {getByText} = renderWithProvider()
    expect(getByText('Edit Outcome')).toBeInTheDocument()
  })

  it('does not show modal if isOpen prop false', () => {
    const {queryByText} = renderWithProvider({overrides: {isOpen: false}})
    expect(queryByText('Edit Outcome')).not.toBeInTheDocument()
  })

  it('calls onCloseHandler on Save button click', async () => {
    const {getByLabelText, getByText} = renderWithProvider()
    fireEvent.change(getByLabelText('Name'), {target: {value: 'Outcome 123'}})
    fireEvent.click(getByText('Save'))
    await act(async () => jest.runOnlyPendingTimers())
    expect(onCloseHandlerMock).toHaveBeenCalledTimes(1)
  })

  it('calls onCloseHandler on Cancel button click', () => {
    const {getByText} = renderWithProvider()
    fireEvent.click(getByText('Cancel'))
    expect(onCloseHandlerMock).toHaveBeenCalledTimes(1)
  })

  it('calls onCloseHandler on Close (X) button click', () => {
    const {getByRole} = renderWithProvider()
    fireEvent.click(within(getByRole('dialog')).getByText('Close'))
    expect(onCloseHandlerMock).toHaveBeenCalledTimes(1)
  })

  it('shows error message below Name field if no name and disables Save button', () => {
    const {getByText, getByLabelText} = renderWithProvider()
    fireEvent.change(getByLabelText('Name'), {target: {value: ''}})
    expect(getByText('Save').closest('button')).toHaveAttribute('disabled')
    expect(getByText('Cannot be blank')).toBeInTheDocument()
  })

  it('shows error message below Name field if name includes only spaces and disables Save button', () => {
    const {getByText, getByLabelText} = renderWithProvider()
    fireEvent.change(getByLabelText('Name'), {target: {value: '  '}})
    expect(getByText('Save').closest('button')).toHaveAttribute('disabled')
    expect(getByText('Cannot be blank')).toBeInTheDocument()
  })

  it('shows error message below Name field if name > 255 characters and disables Save button', () => {
    const {getByText, getByLabelText} = renderWithProvider()
    fireEvent.change(getByLabelText('Name'), {target: {value: 'a'.repeat(256)}})
    expect(getByText('Must be 255 characters or less')).toBeInTheDocument()
    expect(getByText('Save').closest('button')).toHaveAttribute('disabled')
  })

  it('shows error message below displayName field if displayName > 255 characters and disables Save button', () => {
    const {getByText, getByLabelText} = renderWithProvider()
    fireEvent.change(getByLabelText('Friendly Name'), {target: {value: 'a'.repeat(256)}})
    expect(getByText('Must be 255 characters or less')).toBeInTheDocument()
    expect(getByText('Save').closest('button')).toHaveAttribute('disabled')
  })

  it('Shows forms elements when editing in same context', () => {
    const {getByTestId, queryByTestId} = renderWithProvider()
    expect(getByTestId('name-input')).toBeInTheDocument()
    expect(getByTestId('display-name-input')).toBeInTheDocument()
    expect(getByTestId('friendly-description-input')).toBeInTheDocument()
    expect(queryByTestId('readonly-description')).not.toBeInTheDocument()
  })

  it('Hides forms elements when editing in different context', () => {
    const {getByTestId, queryByTestId} = renderWithProvider({
      env: {contextType: 'Course', contextId: '1', friendlyDescriptionFF: true}
    })
    expect(queryByTestId('name-input')).not.toBeInTheDocument()
    expect(queryByTestId('display-name-input')).not.toBeInTheDocument()
    expect(queryByTestId('description-input')).not.toBeInTheDocument()
    expect(getByTestId('friendly-description-input')).toBeInTheDocument()
    expect(getByTestId('readonly-description')).toBeInTheDocument()
  })

  describe('updates the outcome', () => {
    it('displays flash confirmation with proper message if update request succeeds', async () => {
      const mocks = updateLearningOutcomeMocks({
        title: 'Updated name',
        description: 'Updated description',
        displayName: 'Updated friendly name'
      })
      const {getByText, getByDisplayValue, getByLabelText} = renderWithProvider({
        mockOverrides: mocks
      })
      await act(async () => jest.runOnlyPendingTimers())
      fireEvent.change(getByLabelText('Name'), {target: {value: 'Updated name'}})
      fireEvent.change(getByDisplayValue('Outcome description'), {
        target: {value: 'Updated description'}
      })
      fireEvent.change(getByLabelText('Friendly Name'), {target: {value: 'Updated friendly name'}})
      fireEvent.click(getByText('Save'))
      await act(async () => jest.runOnlyPendingTimers())
      expect(onEditLearningOutcomeHandlerMock).toHaveBeenCalled()
      expect(showFlashAlertSpy).toHaveBeenCalledWith({
        message: '"Updated name" was successfully updated.',
        type: 'success'
      })
    })

    it('displays flash confirmation message when removing existing description if update request succeeds', async () => {
      const mocks = updateLearningOutcomeMocks({
        description: '',
        title: 'Outcome',
        displayName: 'Updated friendly name'
      })
      const {getByText, getByDisplayValue, getByLabelText} = renderWithProvider({
        mockOverrides: mocks,
        overrides: {outcome: {...outcome, _id: '3'}}
      })
      await act(async () => jest.runOnlyPendingTimers())
      fireEvent.change(getByDisplayValue('Outcome description'), {
        target: {value: null}
      })
      fireEvent.change(getByLabelText('Friendly Name'), {target: {value: 'Updated friendly name'}})
      fireEvent.click(getByText('Save'))
      await act(async () => jest.runOnlyPendingTimers())
      expect(showFlashAlertSpy).toHaveBeenCalledWith({
        message: '"Outcome" was successfully updated.',
        type: 'success'
      })
    })

    it('displays flash error if update request fails', async () => {
      const {getByText, getByLabelText} = renderWithProvider({
        overrides: {outcome: {...outcome, _id: '2'}}
      })
      await act(async () => jest.runOnlyPendingTimers())
      fireEvent.change(getByLabelText('Name'), {target: {value: 'Updated name'}})
      fireEvent.click(getByText('Save'))
      await act(async () => jest.runOnlyPendingTimers())
      expect(onEditLearningOutcomeHandlerMock).not.toHaveBeenCalled()
      expect(showFlashAlertSpy).toHaveBeenCalledWith({
        message: 'An error occurred while editing this outcome. Please try again.',
        type: 'error'
      })
    })
  })

  describe('updates the friendly description', () => {
    it('updates only friendly description if only friendly description is changed', async () => {
      const {getByText, getByLabelText} = renderWithProvider()
      fireEvent.change(getByLabelText('Friendly description (for parent/student display)'), {
        target: {value: 'Updated friendly description'}
      })
      fireEvent.click(getByText('Save'))
      await act(async () => jest.runOnlyPendingTimers())
      expect(onEditLearningOutcomeHandlerMock).toHaveBeenCalled()
      expect(showFlashAlertSpy).toHaveBeenCalledWith({
        message: '"Outcome" was successfully updated.',
        type: 'success'
      })
    })

    it('handles friendly description update failure', async () => {
      const {getByText, getByLabelText} = renderWithProvider({failResponse: true})
      fireEvent.change(getByLabelText('Friendly description (for parent/student display)'), {
        target: {value: 'Updated friendly description'}
      })
      fireEvent.click(getByText('Save'))
      await act(async () => jest.runOnlyPendingTimers())
      expect(onEditLearningOutcomeHandlerMock).not.toHaveBeenCalled()
      expect(showFlashAlertSpy).toHaveBeenCalledWith({
        message: 'An error occurred while editing this outcome. Please try again.',
        type: 'error'
      })
    })

    it('shows error message below friendly description field if friendly description > 255 characters', () => {
      const {getByText, getByLabelText} = renderWithProvider()
      fireEvent.change(getByLabelText('Friendly description (for parent/student display)'), {
        target: {value: 'a'.repeat(256)}
      })
      expect(getByText('Must be 255 characters or less')).toBeInTheDocument()
    })
  })

  describe('with Friendly Description Feature Flag disabled', () => {
    it('does not display Friendly Description field in modal', async () => {
      const {queryByLabelText} = renderWithProvider({
        env: {contextType: 'Account', contextId: '1', friendlyDescriptionFF: false}
      })
      await act(async () => jest.runOnlyPendingTimers())
      expect(
        queryByLabelText('Friendly description (for parent/student display)')
      ).not.toBeInTheDocument()
    })

    it('does not call friendly description mutation when updating outcome', async () => {
      const mocks = updateLearningOutcomeMocks({
        description: 'Updated description',
        displayName: 'Updated friendly name'
      })
      const {getByText, getByDisplayValue, getByLabelText} = renderWithProvider({
        mockOverrides: mocks,
        env: {contextType: 'Account', contextId: '1', friendlyDescriptionFF: false},
        // mock setFriendlyDescription mutation to throw an error
        failResponse: true
      })
      await act(async () => jest.runOnlyPendingTimers())
      fireEvent.change(getByLabelText('Name'), {target: {value: 'Updated name'}})
      fireEvent.change(getByDisplayValue('Outcome description'), {
        target: {value: 'Updated description'}
      })
      fireEvent.change(getByLabelText('Friendly Name'), {target: {value: 'Updated friendly name'}})
      fireEvent.click(getByText('Save'))
      await act(async () => jest.runOnlyPendingTimers())
      expect(onEditLearningOutcomeHandlerMock).toHaveBeenCalled()
      expect(showFlashAlertSpy).toHaveBeenCalledWith({
        message: '"Updated name" was successfully updated.',
        type: 'success'
      })
    })
  })

  describe('with Individual Outcome Proficiency and Calculation Feature Flag enabled', () => {
    it('displays calculation method selection form if outcome is created in same context', async () => {
      const {getByLabelText} = renderWithProvider({
        env: {
          contextType: 'Account',
          contextId: '1',
          individualOutcomeRatingAndCalculationFF: true
        }
      })
      await act(async () => jest.runOnlyPendingTimers())
      expect(getByLabelText('Calculation Method')).toBeInTheDocument()
    })

    it('displays read only calculation method if outcome is created in different context', async () => {
      const {getByTestId} = renderWithProvider({
        env: {
          contextType: 'Course',
          contextId: '2',
          individualOutcomeRatingAndCalculationFF: true
        }
      })
      await act(async () => jest.runOnlyPendingTimers())
      expect(getByTestId('read-only-calculation-method')).toBeInTheDocument()
    })

    it('updates outcome and its calculation method', async () => {
      const mocks = updateLearningOutcomeMocks({
        description: 'Updated description',
        displayName: 'Updated friendly outcome name',
        calculationMethod: 'latest',
        calculationInt: null,
        individualCalculation: true
      })
      const {getByText, getByDisplayValue, getByLabelText} = renderWithProvider({
        env: {
          contextType: 'Account',
          contextId: '1',
          individualOutcomeRatingAndCalculationFF: true
        },
        mockOverrides: mocks
      })
      await act(async () => jest.runOnlyPendingTimers())
      fireEvent.change(getByLabelText('Name'), {target: {value: 'Updated name'}})
      fireEvent.change(getByLabelText('Friendly Name'), {
        target: {value: 'Updated friendly outcome name'}
      })
      fireEvent.change(getByDisplayValue('Outcome description'), {
        target: {value: 'Updated description'}
      })
      const method = getByDisplayValue('Decaying Average')
      fireEvent.click(method)
      const newMethod = getByText('Most Recent Score')
      fireEvent.click(newMethod)
      fireEvent.click(getByText('Save'))
      await act(async () => jest.runOnlyPendingTimers())
      expect(showFlashAlertSpy).toHaveBeenCalledWith({
        message: '"Updated name" was successfully updated.',
        type: 'success'
      })
    })
  })
})
