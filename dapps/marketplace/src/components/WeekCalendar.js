import React, { Component } from 'react'
import dayjs from 'dayjs'
import { fbt } from 'fbt-runtime'

import Price from 'components/Price'

const resetDrag = {
  dragEnd: null,
  dragStart: null,
  dragging: false
}

class WeekCalendar extends Component {
  constructor(props) {
    super(props)
    this.state = {
      weekStartDate: dayjs().startOf('week') // Default to current week
    }
    this.scrollComponentRef = React.createRef()
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.range && !this.props.range) {
      this.setState({ ...resetDrag })
    }

    if (
      this.props.onChange &&
      (this.state.startDate !== prevState.startDate ||
        this.state.endDate !== prevState.endDate)
    ) {
      // ISO 8601 Interval format
      // e.g. "2019-03-01T01:00:00/2019-03-01T03:00:00"
      const rangeStartDate = this.state.startDate
        ? dayjs(this.state.startDate).format('YYYY-MM-DDTHH:mm:ss')
        : ''
      const rangeEndDate = this.state.endDate
        ? dayjs(this.state.endDate).format('YYYY-MM-DDTHH:mm:ss')
        : ''

      const range = `${rangeStartDate}/${rangeEndDate}`

      this.props.onChange({ range })
    }
  }

  componentDidMount() {
    const slotHeight = 50 // TODO: Read height px dynamically from DOM
    this.scrollComponentRef.current.scrollTop = dayjs().hour() * slotHeight
  }

  render() {
    const { weekStartDate } = this.state,
      // startOfMonth = new Date(year, month),
      // date = dayjs(startOfMonth),
      isBeginning = weekStartDate.isBefore(dayjs()), // Is it before now?
      lastDay = weekStartDate.add(1, 'week'),
      hours = this.props.availability.getAvailability(
        weekStartDate.format('YYYY-MM-DDTHH:00:00'),
        weekStartDate.add(27 * 7, 'hour').format('YYYY-MM-DDTHH:00:00')
      )

    return (
      <div className={`weekCalendar${this.props.small ? ' calendar-sm' : ''}`}>
        <div className="week-chooser">
          <button
            type="button"
            className={`btn btn-outline-secondary prev${
              isBeginning ? ' disabled' : ''
            }`}
            onClick={() => {
              if (isBeginning) {
                return
              }
              this.setState({
                weekStartDate: weekStartDate.add(-1, 'week'),
                ...resetDrag
              })
            }}
          />
          {weekStartDate.format('MMM ')}
          {lastDay.month() != weekStartDate.month()
            ? lastDay.format('- MMM ')
            : ''}
          {weekStartDate.format('YYYY')}
          <button
            type="button"
            className="btn btn-outline-secondary next"
            onClick={() => {
              this.setState({
                weekStartDate: weekStartDate.add(+1, 'week'),
                ...resetDrag
              })
            }}
          />
        </div>

        <div className="day-header">
          <div>{/* Time column */}</div>
          {[...Array(7)].map((_, k) => (
            <div key={k}>
              <div className="day-column-name">
                {weekStartDate.add(k, 'day').format('ddd')}
              </div>
              <div className="day-column-number">
                {weekStartDate.add(k, 'day').format('D')}
              </div>
            </div>
          ))}
        </div>

        <div
          className={`slots${this.state.dragging ? '' : ' inactive'}`}
          ref={this.scrollComponentRef}
        >
          {/* Time label column */}
          {[...Array(24)].map((_, k) => (
            <div key={k} className="time-column-label">
              {weekStartDate.add(k, 'hour').format('ha')}
            </div>
          ))}
          {/* All selectable hours */}
          {Array(7 * 24)
            .fill(0)
            .map((v, idx) => this.renderHour(hours, idx))}
        </div>
      </div>
    )
  }

  renderHour(hours, idx) {
    const hour = hours[idx]
    if (!hour) {
      return (
        <div
          key={idx}
          className={`empty ${idx < 7 ? 'first-row' : 'last-row'}`}
        />
      )
    }

    // Hour in past
    if (dayjs(hour.hour).isBefore(dayjs())) {
      return <div key={idx} className={`hour in-past`} />
    }

    let content = (
      <Price
        price={{ amount: hour.price, currency: this.props.currency }}
        target={this.props.originalCurrency ? this.props.currency : null}
      />
    )
    if (hour.booked && this.props.showBooked) {
      content = fbt('Booked', 'WeekCalendar.booked')
    } else if (hour.unavailable) {
      content = fbt('Unavailable', 'WeekCalendar.unavailable')
    } else if (hour.customPrice) {
      content = <span style={{ color: 'green' }}>{content}</span>
    } else if (hour.nonWorkingHour) {
      content = ''
    }

    const notInSelection =
      !this.state.startDate || (this.state.startDate && this.state.endDate)
    const nonSelectable =
      !notInSelection &&
      idx > this.state.dragStart &&
      hours
        .slice(this.state.dragStart, idx)
        .some(
          s =>
            s.booked ||
            s.unavailable ||
            !s.price ||
            (s.nonWorkingHour && !s.customPrice)
        )

    let interactions = {}
    if (this.props.interactive !== false) {
      interactions = {
        onClick: () => {
          const { startDate, endDate } = this.state
          if (!startDate || nonSelectable) {
            // Start date
            return this.setState({
              dragStart: idx,
              startDate: hour.hour,
              dragEnd: null,
              endDate: null
            })
          }

          const rangeStartDate = dayjs(startDate)
          const selectedDate = dayjs(hour.hour)

          if (!endDate && selectedDate.isAfter(rangeStartDate)) {
            // Range and not a prior date
            return this.setState({
              dragEnd: idx,
              endDate: hour.hour
            })
          }

          return this.setState({
            dragStart: idx,
            startDate: hour.hour,
            dragEnd: null,
            endDate: null
          })
        },
        onMouseOver: () => this.setState({ dragOver: idx })
      }
    }

    return (
      <div
        key={idx}
        className={`hour ${this.getClass(idx, hour, nonSelectable)}`}
        {...interactions}
      >
        <div>{content}</div>
      </div>
    )
  }

  // Get class for this hour, determining if e.g. it is selected
  getClass(idx, hour, nonSelectable) {
    const { startDate, endDate } = this.state

    let unavailable =
      nonSelectable ||
      hour.unavailable ||
      hour.booked ||
      !hour.price ||
      (hour.nonWorkingHour && !hour.customPrice)

    const notInSelection = !startDate || (startDate && endDate)

    const className = []
    if (this.props.interactive !== false && !unavailable) {
      className.push('active')
    } else if (unavailable) {
      className.push('unavailable')
    }

    if (hour.nonWorkingHour && !hour.customPrice) {
      unavailable = true
      className.push('nonWorkingHour')
    }

    if (startDate) {
      const slotHour = dayjs(hour.hour)
      const rangeStart = startDate ? dayjs(startDate) : null
      const rangeEnd = endDate ? dayjs(endDate) : null

      if (rangeStart.isSame(slotHour)) {
        className.push(endDate ? 'start' : 'single')
      } else if (endDate && rangeEnd.isSame(slotHour)) {
        className.push('end')
      } else if (endDate && slotHour.isBetween(rangeStart, rangeEnd)) {
        className.push('mid')
      } else if (
        !notInSelection &&
        (unavailable || slotHour.isBefore(rangeStart))
      ) {
        className.push('unavailable')
      } else {
        className.push('unselected')
      }
    }

    return className.join(' ')
  }
}

export default WeekCalendar

require('react-styl')(`
  .weekCalendar
    margin-bottom: 2rem
    &.calendar-sm .days > .day
      height: auto
    .slots
      height: 500px
      overflow-y: scroll
      overflow-x: hidden
      display: grid
      grid-template-columns: repeat(8, 1fr)
      grid-template-rows: repeat(24, 1fr)
      grid-auto-flow: column
      user-select: none
      border-style: solid
      border-color: #c2cbd3
      border-width: 1px 1px 1px 1px
      > .empty.first-row
        border-bottom: 1px solid #c2cbd3
      > .time-column-label
        border-style: solid
        border-color: #c2cbd3
        border-width: 0 1px 0 0
        display: flex
        align-items: center
        justify-content: center
      > .hour
        height: 50px
        min-height: 3.5rem
        color: #455d75
        font-size: 14px
        font-weight: normal
        padding: 0.25rem 0.5rem
        display: flex
        flex-direction: column;
        justify-content: space-between;
        min-width: 0

        border-style: solid
        border-color: #c2cbd3
        border-width: 0 0 1px 1px
        position: relative
        &.end-row
          border-right-width: 1px

        &.in-past,&.unavailable
          background-color: var(--pale-grey)
        &.nonWorkingHour
          background-color: var(--pale-grey)
        &.unavailable,&nonWorkingHour
          div:nth-child(1)
            color: var(--light)

        > div:nth-child(2)
          font-weight: bold
          white-space: nowrap
          overflow: hidden
        &::after
          z-index: 1
          content: ""
          position: absolute
          border: 3px solid transparent
          top: -2px
          left: -2px
          right: -2px
          bottom: -2px
        &.active::after
          cursor: pointer
        &.active.unselected:hover
          &::after
            border: 3px solid black
        &.start,&.mid,&.end,&.single
          background-color: #007fff
          color: var(--white)
        &.start
          border-top-left-radius: 10px
          border-top-right-radius: 10px
        &.end
          border-bottom-left-radius: 10px
          border-bottom-right-radius: 10px
        &.single
          border-radius: 10px
    .day-header
      display: flex
      > div
        display: flex
        align-items: center
        flex-direction: column
      border-width: 0 0 0 0
      border-style: solid
      border-color: #c2cbd3
      justify-content: space-between;
      text-align: left
      font-size: 14px
      font-weight: normal
      color: var(--bluey-grey)
      margin-top: 1rem
      line-height: 2rem
      > div
        flex: 1
        .day-column-name
          text-transform: uppercase
        .day-column-number
          font-size: 24px
          color: var(--dark)

    .week-chooser
      display: flex
      justify-content: space-between;
      font-family: Poppins
      font-size: 24px
      font-weight: 300
      .btn
        border-color: #c2cbd3
        min-width: auto
        &::before
          content: "";
          width: 0.75rem;
          height: 0.75rem;
          border-width: 0 0 1px 1px;
          border-color: #979797;
          border-style: solid;
          transform: rotate(45deg) translate(3px, -1px)
          display: inline-block;
        &.next::before
          transform: rotate(225deg) translate(1px, -2px)
        &:hover::before
          border-color: var(--white)
`)
