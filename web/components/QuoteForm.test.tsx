// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import QuoteForm from './QuoteForm.tsx'

afterEach(cleanup)

const totalRow = () =>
  within(summary()).getByText('Total').closest('tr') as HTMLElement

const summary = () =>
  screen.getByRole('complementary', { name: 'Quote summary' })

describe('QuoteForm', () => {
  it('shows a live price for the default form', () => {
    render(<QuoteForm onSubmit={vi.fn()} />)

    expect(totalRow()).toHaveTextContent('RM 840.00')
  })

  it('shows a field error and hides the price when quantity is invalid', async () => {
    const user = userEvent.setup()
    render(<QuoteForm onSubmit={vi.fn()} />)

    const quantity = screen.getByLabelText(/Quantity/)
    await user.clear(quantity)
    await user.type(quantity, '24')
    await user.tab()

    expect(quantity).toHaveAttribute('aria-invalid', 'true')
    expect(
      screen.getByText(/Screen print needs at least 25 shirts/),
    ).toBeInTheDocument()
    expect(within(summary()).queryByText('Total')).not.toBeInTheDocument()
    expect(
      within(summary()).getByText('Fix the highlighted fields to see a price.'),
    ).toBeInTheDocument()
  })

  it('updates the price when options change', async () => {
    const user = userEvent.setup()
    render(<QuoteForm onSubmit={vi.fn()} />)

    await user.click(screen.getByLabelText('Rush order (+15%)'))

    expect(within(summary()).getByText('RM 966.00')).toBeInTheDocument()
  })

  it('switches product, resetting fields and showing only relevant ones', async () => {
    const user = userEvent.setup()
    render(<QuoteForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('Ink colours')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Vinyl banner' }))

    expect(screen.queryByLabelText('Ink colours')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Size')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Eyelets (+RM 4.00 per banner)'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Quantity/)).toHaveValue('1')
    expect(totalRow()).toHaveTextContent('RM 55.00')
  })

  it('does not submit without a customer name and focuses the problem', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<QuoteForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Save quote' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Enter the customer name')).toBeInTheDocument()
    expect(screen.getByLabelText('Customer name')).toHaveFocus()
  })

  it('submits a trimmed, validated request', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<QuoteForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Customer name'), '  Aisyah  ')
    await user.click(screen.getByRole('button', { name: 'Save quote' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      customerName: 'Aisyah',
      customerEmail: null,
      input: {
        productId: 'tshirt',
        method: 'screen',
        quantity: 50,
        locations: 1,
        colours: 2,
        rush: false,
      },
    })
  })

  it('rejects an invalid email before submitting', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<QuoteForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Customer name'), 'Aisyah')
    await user.type(screen.getByLabelText('Email (optional)'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Save quote' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
  })

  it('shows server field errors next to their inputs and clears them on edit', async () => {
    const user = userEvent.setup()
    const errors = { 'input.quantity': 'Server says the quantity is wrong' }
    render(<QuoteForm onSubmit={vi.fn()} serverErrors={errors} />)

    expect(
      screen.getByText('Server says the quantity is wrong'),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Quantity/), '0')

    expect(
      screen.queryByText('Server says the quantity is wrong'),
    ).not.toBeInTheDocument()
  })

  it('disables the save button while submitting', () => {
    render(<QuoteForm onSubmit={vi.fn()} submitting />)

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })
})
