document.addEventListener('DOMContentLoaded', () => {
	const container = document.querySelector('.page-wrapper')
	const starfield = document.createElement('div')
	starfield.className = 'starfield'
	container.appendChild(starfield)

	// Create initial stars
	const numberOfStars = 300
	const stars = []

	function createStar() {
		const star = document.createElement('div')
		star.className = 'star'

		// Random position
		const x = Math.random() * window.innerWidth
		const y = Math.random() * window.innerHeight

		// Random size (more variation in sizes)
		const size = Math.random() * 2 + (Math.random() > 0.95 ? 1.5 : 0)

		// More subtle initial opacity
		const opacity = Math.random() * 0.15 + 0.05

		star.style.cssText = `
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            opacity: ${opacity};
        `

		return star
	}

	// Initialize stars
	for (let i = 0; i < numberOfStars; i++) {
		const star = createStar()
		starfield.appendChild(star)
		stars.push(star)
	}

	// Animate stars
	function twinkle() {
		stars.forEach((star) => {
			// Random chance to twinkle
			if (Math.random() > 0.98) {
				const currentOpacity = parseFloat(star.style.opacity)
				const targetOpacity =
					currentOpacity < 0.1
						? Math.random() * 0.15 + 0.05 // Brighter
						: Math.random() * 0.05 + 0.02 // Dimmer

				// Slower transition for more subtle effect
				star.style.transition = 'opacity 1.5s ease-in-out'
				star.style.opacity = targetOpacity
			}
		})

		requestAnimationFrame(twinkle)
	}

	// Start animation
	twinkle()

	// Form handling
	const emailForm = document.querySelector('.input-group')
	const emailInput = emailForm.querySelector('input[type="email"]')
	const honeypotInput = emailForm.querySelector('input[name="contact_me_by_fax"]')
	const notifyButton = emailForm.querySelector('.notify-btn')

	// Check if user has already signed up
	/*if (localStorage.getItem('mcp_demo_signup')) {
		const savedEmail = localStorage.getItem('mcp_demo_signup')
		showSuccessState(savedEmail)
	}*/

	function showSuccessState(email) {
		const inputGroup = emailInput.closest('.input-group')
		inputGroup.classList.add('success')
		emailInput.value = email
		emailInput.disabled = true
		notifyButton.disabled = true

		// Update button
		notifyButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `
		notifyButton.classList.add('success')
		createConfetti(notifyButton)
	}

	// Rate limiting configuration
	const RATE_LIMIT_DURATION = 60000 // 1 minute
	const MAX_ATTEMPTS = 5
	let attemptCount = 0
	let lastAttemptTime = 0

	function checkRateLimit() {
		const now = Date.now()
		if (now - lastAttemptTime > RATE_LIMIT_DURATION) {
			attemptCount = 0
		}

		if (attemptCount >= MAX_ATTEMPTS) {
			return false
		}

		attemptCount++
		lastAttemptTime = now
		return true
	}

	// Enhanced email validation
	function isValidEmail(email) {
		if (email.length > 254) return false
		const re =
			/^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.){1,8}[a-zA-Z]{2,63}$/
		return re.test(email)
	}

	// XSS Prevention
	function sanitizeInput(str) {
		const div = document.createElement('div')
		div.textContent = str
		return div.innerHTML
	}

	// Debounced email validation
	const debounce = (fn, delay) => {
		let timeoutId
		return (...args) => {
			clearTimeout(timeoutId)
			timeoutId = setTimeout(() => fn(...args), delay)
		}
	}

	// Retry logic for API calls
	async function retryFetch(url, options, maxRetries = 3) {
		for (let i = 0; i < maxRetries; i++) {
			try {
				const response = await fetch(url, options)
				const data = await response.json()
				return { response, data }
			} catch (error) {
				if (i === maxRetries - 1) throw error
				await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)))
			}
		}
	}

	// Enhanced toast function with accessibility
	function showToast(message, duration = 3000) {
		const existingToast = document.querySelector('.toast')
		if (existingToast) {
			existingToast.remove()
		}

		const toast = document.createElement('div')
		toast.className = 'toast'
		toast.setAttribute('role', 'alert')
		toast.setAttribute('aria-live', 'polite')
		toast.textContent = sanitizeInput(message)
		document.body.appendChild(toast)

		toast.offsetHeight
		toast.classList.add('show')

		setTimeout(() => {
			toast.classList.remove('show')
			setTimeout(() => toast.remove(), 300)
		}, duration)
	}

	// Setup accessibility attributes
	function setupAccessibility() {
		emailInput.setAttribute('aria-label', 'Email address for notification')
		notifyButton.setAttribute('aria-label', 'Sign up for notification')
		document.querySelector('.success-message')?.setAttribute('role', 'status')
	}

	// Debounced email validation on input
	const validateEmailDebounced = debounce((email) => {
		const isValid = isValidEmail(email)
		emailInput.style.border = isValid ? '' : '1px solid red'
	}, 300)

	emailInput.addEventListener('input', (e) => validateEmailDebounced(e.target.value))

	// Enhanced click handler with all improvements
	notifyButton.addEventListener('click', async (e) => {
		e.preventDefault()
		const email = emailInput.value.trim()

		// Rate limit check
		if (!checkRateLimit()) {
			showToast('Please wait a minute before trying again.')
			return
		}

		// Basic validation
		if (!email) {
			emailInput.style.border = '1px solid red'
			return
		}

		if (!isValidEmail(email)) {
			emailInput.style.border = '1px solid red'
			showToast('Please enter a valid email address.')
			return
		}

		// Check if already signed up
		/*if (localStorage.getItem('mcp_demo_signup')) {
			return
		}*/

		// Honeypot check
		if (honeypotInput.value) {
			console.log('Bot detected')
			return
		}

		try {
			const { response, data } = await retryFetch(
				'https://starbasedb-3285.outerbase.workers.dev/query',
				{
					method: 'POST',
					headers: {
						'X-Starbase-Source': 'internal',
						Authorization: 'Bearer 8gmjguywgvsy2hvxnqpqzapwjq896ke3',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						sql: 'INSERT INTO signups (email, status, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
						params: [sanitizeInput(email), 'pending'],
					}),
				}
			)

			if (!response.ok) {
				throw new Error(data.error || 'Signup failed')
			}

			localStorage.setItem('mcp_demo_signup', email)
			showSuccessState(email)
			setupCalendarActions()
			setupAccessibility()
		} catch (error) {
			console.error('Error:', error)
			emailInput.style.border = '1px solid red'

			if (error.message.includes('UNIQUE constraint failed')) {
				showToast('This email is already registered for the demo. Check your inbox for details.')
				localStorage.setItem('mcp_demo_signup', email)
				showSuccessState(email)
				setupCalendarActions()
				setupAccessibility()
			} else {
				showToast('Something went wrong. Please try again.')
			}
		}
	})

	// Initialize accessibility
	setupAccessibility()

	function setupCalendarActions() {
		const calendarActions = document.querySelectorAll(
			'.success-message .calendar-action, .calendar-option'
		)
		const eventDetails =
			"Get a preview of the future of agentic software. See how the world's most innovative platforms have connected agents to their services with MCP to build a new class of product experiences.\n\nJoin Live: https://cloudflare.tv/mcp-demo-day"
		const location = 'https://cloudflare.tv/mcp-demo-day'

		calendarActions.forEach((option) => {
			option.addEventListener('click', () => {
				const calendarType = option.dataset.calendarType

				switch (calendarType) {
					case 'google':
						window.open(
							'https://calendar.google.com/calendar/render?action=TEMPLATE&text=MCP+Demo+Day&details=Get+a+preview+of+the+future+of+agentic+software.+See+how+the+world%27s+most+innovative+platforms+have+connected+agents+to+their+services+with+MCP+to+build+a+new+class+of+product+experiences.%0A%0AJoin+Live%3A+https%3A%2F%2Fcloudflare.tv%2Fmcp-demo-day&location=https%3A%2F%2Fcloudflare.tv%2Fmcp-demo-day&dates=20250501T170000Z%2F20250501T183000Z',
							'_blank'
						)
						break

					case 'outlook':
						window.open(
							'https://outlook.live.com/calendar/0/deeplink/compose?subject=MCP+Demo+Day&body=Get+a+preview+of+the+future+of+agentic+software.+See+how+the+world%27s+most+innovative+platforms+have+connected+agents+to+their+services+with+MCP+to+build+a+new+class+of+product+experiences.%0A%0AJoin+Live%3A+https%3A%2F%2Fcloudflare.tv%2Fmcp-demo-day&startdt=2025-05-01T17%3A00%3A00Z&enddt=2025-05-01T18%3A30%3A00Z&location=https%3A%2F%2Fcloudflare.tv%2Fmcp-demo-day',
							'_blank'
						)
						break

					case 'apple':
					case 'ics':
						const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MCP Demo Day//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:MCP Demo Day
DESCRIPTION:${eventDetails.replace(/\n/g, '\\n')}
LOCATION:${location}
DTSTART:20250501T170000Z
DTEND:20250501T183000Z
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`

						if (calendarType === 'apple') {
							const dataUri = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsContent)
							window.open(dataUri)
						} else {
							const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
							const link = document.createElement('a')
							link.href = window.URL.createObjectURL(blob)
							link.download = 'mcp_demo_day.ics'
							document.body.appendChild(link)
							link.click()
							document.body.removeChild(link)
						}
						break
				}

				// Close the dialog if it's open
				const dialog = document.getElementById('calendarDialog')
				if (dialog) {
					dialog.close()
				}
			})
		})
	}

	// Call setupCalendarActions immediately if needed
	setupCalendarActions()

	// Remove red border on input focus
	emailInput.addEventListener('focus', () => {
		emailInput.style.border = 'none'
	})

	// Company list hover effect
	const companies = document.querySelectorAll('.demo-companies li')
	companies.forEach((company) => {
		company.addEventListener('mouseenter', () => {
			companies.forEach((c) => {
				if (c !== company) {
					c.style.opacity = '0.5'
				}
			})
		})

		company.addEventListener('mouseleave', () => {
			companies.forEach((c) => {
				c.style.opacity = '1'
			})
		})
	})

	// Setup company backgrounds
	const companyNames = [
		'atlassian',
		'cloudflare',
		'intercom',
		'linear',
		'paypal',
		'sentry',
		'square',
		'stripe',
		'webflow',
		'more',
	]

	const demoList = document.querySelector('.demo-companies')
	const companyItems = demoList.querySelectorAll('li')

	// Add data attributes to company items
	companyItems.forEach((item, index) => {
		const company = companyNames[index]
		if (company) {
			item.setAttribute('data-company', company)
		}
	})

	// Create background containers for each company
	companyNames.forEach((company) => {
		const background = document.createElement('div')
		background.className = `company-background ${company}`

		// Load SVG from file
		fetch(`/public/${company}.svg`)
			.then((response) => response.text())
			.then((svgContent) => {
				// Clean up the SVG to remove any fill paths
				const parser = new DOMParser()
				const doc = parser.parseFromString(svgContent, 'image/svg+xml')
				const svg = doc.querySelector('svg')

				// Remove any fill attributes and set stroke
				svg.querySelectorAll('path, circle, rect').forEach((path) => {
					path.setAttribute('fill', 'none')
					path.setAttribute('stroke', 'currentColor')
					path.setAttribute('stroke-width', '.5')
				})

				background.innerHTML = svg.outerHTML
			})
			.catch((error) => console.error(`Error loading ${company}.svg:`, error))

		demoList.appendChild(background)
	})

	// Add cycling animation for company backgrounds
	let currentBackgroundIndex = 0
	let isHovering = false
	let hoverCompany = null
	const backgrounds = document.querySelectorAll('.company-background')

	function cycleBackgrounds() {
		// Remove active class from all backgrounds and company names
		backgrounds.forEach((bg) => bg.classList.remove('active'))
		companyItems.forEach((item) => item.classList.remove('active'))

		// If hovering, show the hovered company's background and highlight its name
		if (isHovering && hoverCompany) {
			const hoverBackground = Array.from(backgrounds).find((bg) =>
				bg.classList.contains(hoverCompany)
			)
			const hoverItem = Array.from(companyItems).find(
				(item) => item.getAttribute('data-company') === hoverCompany
			)
			if (hoverBackground) {
				hoverBackground.classList.add('active')
				if (hoverItem) hoverItem.classList.add('active')
				return
			}
		}

		// Otherwise, show the next background in the cycle and highlight its name
		backgrounds[currentBackgroundIndex].classList.add('active')
		companyItems[currentBackgroundIndex].classList.add('active')
		currentBackgroundIndex = (currentBackgroundIndex + 1) % backgrounds.length
	}

	// Start cycling every 3 seconds
	setInterval(cycleBackgrounds, 3000)
	// Show first background immediately
	cycleBackgrounds()

	// Handle hover states
	companyItems.forEach((item) => {
		item.addEventListener('mouseenter', () => {
			isHovering = true
			hoverCompany = item.getAttribute('data-company')
			cycleBackgrounds() // Show the hovered company immediately
		})

		item.addEventListener('mouseleave', () => {
			isHovering = false
			hoverCompany = null
			cycleBackgrounds() // Resume normal cycling
		})
	})

	function parseDateTime() {
		const dateText = document.querySelector('.date-time h2').textContent.trim() // e.g., "APRIL 30TH, 2025"
		const timeText = document.querySelector('.date-time h3').textContent.trim() // e.g., "ONLINE, 1:00 PM PT"

		// Remove ordinal indicators (st, nd, rd, th) and parse date
		const cleanDateText = dateText.replace(/(ST|ND|RD|TH),/i, ',')

		// Create a more precise regex to match the date format
		const dateTimeParts = cleanDateText.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/i)
		// Handle "ONLINE, " prefix in time
		const timeParts = timeText
			.replace(/^ONLINE,\s*/i, '')
			.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*(PST|PDT|EST|EDT|CST|CDT|MST|MDT|PT)?$/i)

		if (!dateTimeParts || !timeParts) {
			throw new Error('Invalid date/time format')
		}

		const [, month, day, year] = dateTimeParts
		const [, hours, minutes, ampm, timezone] = timeParts

		let hour24 = parseInt(hours)

		// Convert to 24-hour format
		if (ampm.toUpperCase() === 'PM' && hour24 < 12) hour24 += 12
		if (ampm.toUpperCase() === 'AM' && hour24 === 12) hour24 = 0

		// Create date in UTC
		const date = new Date(
			Date.UTC(parseInt(year), getMonthIndex(month), parseInt(day), hour24, parseInt(minutes), 0)
		)

		// Since the time is specified in PT (Pacific Time), adjust for PT (-7 hours from UTC during PDT)
		date.setUTCHours(date.getUTCHours() - 7)

		if (isNaN(date.getTime())) {
			throw new Error('Invalid date/time format')
		}

		return date
	}

	// Helper function to get month index (0-11) from month name
	function getMonthIndex(month) {
		const months = {
			JANUARY: 0,
			JAN: 0,
			FEBRUARY: 1,
			FEB: 1,
			MARCH: 2,
			MAR: 2,
			APRIL: 3,
			APR: 3,
			MAY: 4,
			JUNE: 5,
			JUN: 5,
			JULY: 6,
			JUL: 6,
			AUGUST: 7,
			AUG: 7,
			SEPTEMBER: 8,
			SEP: 8,
			OCTOBER: 9,
			OCT: 9,
			NOVEMBER: 10,
			NOV: 10,
			DECEMBER: 11,
			DEC: 11,
		}
		return months[month.toUpperCase()]
	}
})

// Helper functions
function isValidEmail(email) {
	const re =
		/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
	return re.test(email.toLowerCase())
}

// Particle System
function createParticle() {
	const particle = document.createElement('div')
	particle.className = 'particle'

	// Random size between 3-6px
	const size = Math.random() * 3 + 3
	particle.style.width = `${size}px`
	particle.style.height = `${size}px`

	// Random starting position, but keep particles within viewport bounds
	const startX = Math.random() * (window.innerWidth - size)
	const startY = window.innerHeight + size

	particle.style.left = `${startX}px`
	particle.style.top = `${startY}px`

	// Random animation duration between 6-10 seconds
	const duration = Math.random() * 4000 + 6000
	particle.style.animation = `floatUp ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`

	document.body.appendChild(particle)

	// Cleanup after animation
	setTimeout(() => {
		if (particle && particle.parentNode) {
			particle.parentNode.removeChild(particle)
		}
	}, duration)
}

// Particle manager
let particleInterval
const startParticles = () => {
	// Create initial batch of particles
	for (let i = 0; i < 5; i++) {
		setTimeout(() => createParticle(), i * 200)
	}

	// Create a new particle every 400ms
	particleInterval = setInterval(() => {
		// Limit to 15 particles at a time for better performance
		if (document.querySelectorAll('.particle').length < 15) {
			createParticle()
		}
	}, 400)
}

// Cleanup function
const cleanupParticles = () => {
	if (particleInterval) {
		clearInterval(particleInterval)
		particleInterval = null
	}
	document.querySelectorAll('.particle').forEach((particle) => {
		if (particle.parentNode) {
			particle.parentNode.removeChild(particle)
		}
	})
}

// Start particles when page loads
startParticles()

// Cleanup on page unload
window.addEventListener('unload', cleanupParticles)

// Pause particles when page is not visible
document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		cleanupParticles()
	} else {
		startParticles()
	}
})

// Restart particles on window resize
let resizeTimeout
window.addEventListener('resize', () => {
	if (resizeTimeout) {
		clearTimeout(resizeTimeout)
	}
	resizeTimeout = setTimeout(() => {
		cleanupParticles()
		startParticles()
	}, 200)
})

function createConfetti(button) {
	const colors = ['#FF6633', '#FF8533', '#FF9966', '#FFAA80']
	const confettiCount = 20

	for (let i = 0; i < confettiCount; i++) {
		const confetti = document.createElement('div')
		confetti.className = 'confetti'

		// Random size between 4-8px
		const size = Math.random() * 4 + 4
		confetti.style.width = `${size}px`
		confetti.style.height = `${size}px`

		// Random color from our palette
		confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]

		// Random position behind the button
		const startX = Math.random() * button.offsetWidth
		confetti.style.left = `${startX}px`
		confetti.style.top = '50%'

		// Random animation duration and delay
		const duration = Math.random() * 400 + 600
		const delay = Math.random() * 200
		confetti.style.animation = `confettiFall ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms forwards`

		button.appendChild(confetti)

		// Cleanup
		setTimeout(() => {
			if (confetti.parentNode === button) {
				button.removeChild(confetti)
			}
		}, duration + delay)
	}
}
