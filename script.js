// DOM Elements
const loanAmountInput = document.getElementById('loan-amount');
const interestRateInput = document.getElementById('interest-rate');
const loanTermInput = document.getElementById('loan-term');
const balloonPaymentInput = document.getElementById('balloon-payment');
const paymentFrequencySelect = document.getElementById('payment-frequency');
const feesInput = document.getElementById('fees');
const gstCheckbox = document.getElementById('gst');
const calculateBtn = document.getElementById('calculate-btn');
const resultsContainer = document.getElementById('results-container');

// Result Elements
const regularPaymentElement = document.getElementById('regular-payment');
const balloonAmountElement = document.getElementById('balloon-amount');
const totalRepaymentsElement = document.getElementById('total-repayments');
const totalInterestElement = document.getElementById('total-interest');
const totalCostElement = document.getElementById('total-cost');
const amortizationBody = document.getElementById('amortization-body');

// Chart
let repaymentChart = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Add event listener to the calculate button
    calculateBtn.addEventListener('click', performCalculation);
    
    // Automatically perform calculation with default values on page load
    performCalculation();
});

// Format currency function
const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', { 
        style: 'currency', 
        currency: 'AUD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
};

// Calculate payments
const calculatePayments = (loanAmount, interestRate, loanTerm, balloonPercentage, paymentFrequency, fees) => {
    // Convert annual interest rate to decimal and then to per-period rate
    const periodsPerYear = getPeriodsPerYear(paymentFrequency);
    const totalPeriods = loanTerm * periodsPerYear;
    const periodicInterestRate = (interestRate / 100) / periodsPerYear;
    
    // Calculate balloon payment amount
    const balloonAmount = (balloonPercentage / 100) * loanAmount;
    
    // Adjust loan amount for fees if they're being financed
    const loanPrincipal = loanAmount + fees;
    
    // Calculate regular payment using the amortization formula with balloon
    let regularPayment;
    
    if (periodicInterestRate === 0) {
        // For 0% interest rate
        regularPayment = (loanPrincipal - balloonAmount) / totalPeriods;
    } else {
        // For normal interest rates
        regularPayment = (loanPrincipal - balloonAmount * Math.pow(1 + periodicInterestRate, -totalPeriods)) * 
            (periodicInterestRate / (1 - Math.pow(1 + periodicInterestRate, -totalPeriods)));
    }
    
    // Generate amortization schedule
    const schedule = [];
    let balance = loanPrincipal;
    let totalInterest = 0;
    
    for (let period = 1; period <= totalPeriods; period++) {
        const interestPayment = balance * periodicInterestRate;
        let principalPayment = regularPayment - interestPayment;
        
        // Handle last payment with balloon
        if (period === totalPeriods) {
            principalPayment = balance - balloonAmount;
        }
        
        totalInterest += interestPayment;
        balance -= principalPayment;
        
        // Ensure balance doesn't go below the balloon amount in the last period
        if (period === totalPeriods) {
            balance = balloonAmount;
        }
        
        schedule.push({
            period,
            payment: regularPayment,
            principal: principalPayment,
            interest: interestPayment,
            balance
        });
    }
    
    const totalRepayments = (regularPayment * totalPeriods) + balloonAmount;
    
    return {
        regularPayment,
        balloonAmount,
        totalRepayments,
        totalInterest,
        totalCost: totalRepayments + fees,
        schedule,
        periodsPerYear,
        totalPeriods
    };
};

// Get periods per year based on payment frequency
const getPeriodsPerYear = (frequency) => {
    switch (frequency) {
        case 'weekly':
            return 52;
        case 'fortnightly':
            return 26;
        case 'monthly':
        default:
            return 12;
    }
};

// Create or update the repayment chart
const updateChart = (schedule, periodsPerYear, totalPeriods) => {
    const ctx = document.getElementById('repayment-chart').getContext('2d');
    
    // Clear existing chart if it exists
    if (repaymentChart) {
        repaymentChart.destroy();
    }
    
    // Prepare data for the chart
    const labels = [];
    const principalData = [];
    const interestData = [];
    
    // Group data by year for better visualization
    const yearsData = [];
    let currentYear = 1;
    let yearlyPrincipal = 0;
    let yearlyInterest = 0;
    
    schedule.forEach((payment, index) => {
        if (index % periodsPerYear === 0 && index !== 0) {
            yearsData.push({
                year: currentYear,
                principal: yearlyPrincipal,
                interest: yearlyInterest
            });
            
            currentYear++;
            yearlyPrincipal = 0;
            yearlyInterest = 0;
        }
        
        yearlyPrincipal += payment.principal;
        yearlyInterest += payment.interest;
        
        // For the last period if it doesn't complete a year
        if (index === schedule.length - 1 && index % periodsPerYear !== 0) {
            yearsData.push({
                year: currentYear,
                principal: yearlyPrincipal,
                interest: yearlyInterest
            });
        }
    });
    
    // Prepare chart data from yearly data
    yearsData.forEach(yearData => {
        labels.push(`Year ${yearData.year}`);
        principalData.push(yearData.principal);
        interestData.push(yearData.interest);
    });
    
    // Create the chart
    repaymentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Principal',
                    data: principalData,
                    backgroundColor: '#4361ee',
                    borderColor: '#4361ee',
                    borderWidth: 1
                },
                {
                    label: 'Interest',
                    data: interestData,
                    backgroundColor: '#ff9800',
                    borderColor: '#ff9800',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.raw);
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            }
        }
    });
    
    // Set a fixed height for the chart container
    document.querySelector('.chart-container').style.height = '350px';
};

// Update the amortization table
const updateAmortizationTable = (schedule, frequency) => {
    amortizationBody.innerHTML = '';
    
    // Determine how many periods to show initially (first year)
    const periodsPerYear = getPeriodsPerYear(frequency);
    const maxInitialPeriods = Math.min(periodsPerYear, schedule.length);
    
    for (let i = 0; i < maxInitialPeriods; i++) {
        const payment = schedule[i];
        const row = document.createElement('tr');
        
        // Create period cell
        const periodCell = document.createElement('td');
        periodCell.textContent = getPeriodLabel(i + 1, frequency);
        row.appendChild(periodCell);
        
        // Create payment cell
        const paymentCell = document.createElement('td');
        paymentCell.textContent = formatCurrency(payment.payment);
        row.appendChild(paymentCell);
        
        // Create principal cell
        const principalCell = document.createElement('td');
        principalCell.textContent = formatCurrency(payment.principal);
        row.appendChild(principalCell);
        
        // Create interest cell
        const interestCell = document.createElement('td');
        interestCell.textContent = formatCurrency(payment.interest);
        row.appendChild(interestCell);
        
        // Create balance cell
        const balanceCell = document.createElement('td');
        balanceCell.textContent = formatCurrency(payment.balance);
        row.appendChild(balanceCell);
        
        amortizationBody.appendChild(row);
    }
    
    // If there are more periods than shown initially, add a "Show more" row
    if (schedule.length > maxInitialPeriods) {
        const showMoreRow = document.createElement('tr');
        const showMoreCell = document.createElement('td');
        showMoreCell.colSpan = 5;
        showMoreCell.textContent = 'Show more...';
        showMoreCell.style.textAlign = 'center';
        showMoreCell.style.cursor = 'pointer';
        showMoreCell.style.color = '#4361ee';
        
        showMoreCell.addEventListener('click', () => {
            // When clicked, show all periods
            updateFullAmortizationTable(schedule, frequency);
            showMoreRow.remove();
        });
        
        showMoreRow.appendChild(showMoreCell);
        amortizationBody.appendChild(showMoreRow);
    }
};

// Update the full amortization table when "Show more" is clicked
const updateFullAmortizationTable = (schedule, frequency) => {
    amortizationBody.innerHTML = '';
    
    schedule.forEach((payment, index) => {
        const row = document.createElement('tr');
        
        // Create period cell
        const periodCell = document.createElement('td');
        periodCell.textContent = getPeriodLabel(index + 1, frequency);
        row.appendChild(periodCell);
        
        // Create payment cell
        const paymentCell = document.createElement('td');
        paymentCell.textContent = formatCurrency(payment.payment);
        row.appendChild(paymentCell);
        
        // Create principal cell
        const principalCell = document.createElement('td');
        principalCell.textContent = formatCurrency(payment.principal);
        row.appendChild(principalCell);
        
        // Create interest cell
        const interestCell = document.createElement('td');
        interestCell.textContent = formatCurrency(payment.interest);
        row.appendChild(interestCell);
        
        // Create balance cell
        const balanceCell = document.createElement('td');
        balanceCell.textContent = formatCurrency(payment.balance);
        row.appendChild(balanceCell);
        
        amortizationBody.appendChild(row);
    });
};

// Get the period label based on frequency
const getPeriodLabel = (period, frequency) => {
    switch (frequency) {
        case 'weekly':
            return `Week ${period}`;
        case 'fortnightly':
            return `Fortnight ${period}`;
        case 'monthly':
        default:
            return `Month ${period}`;
    }
};

// Main calculation function
const performCalculation = () => {
    // Get input values
    const loanAmount = parseFloat(loanAmountInput.value);
    const interestRate = parseFloat(interestRateInput.value);
    const loanTerm = parseFloat(loanTermInput.value);
    const balloonPercentage = parseFloat(balloonPaymentInput.value);
    const paymentFrequency = paymentFrequencySelect.value;
    const fees = parseFloat(feesInput.value);
    const includeGst = gstCheckbox.checked;
    
    // Validate inputs
    if (isNaN(loanAmount) || isNaN(interestRate) || isNaN(loanTerm) || isNaN(balloonPercentage) || isNaN(fees)) {
        alert('Please fill in all fields with valid numbers.');
        return;
    }
    
    // Adjust loan amount for GST if checked
    let adjustedLoanAmount = loanAmount;
    if (includeGst) {
        adjustedLoanAmount = loanAmount * 1.1; // Add 10% GST
    }
    
    // Calculate payments
    const result = calculatePayments(
        adjustedLoanAmount,
        interestRate,
        loanTerm,
        balloonPercentage,
        paymentFrequency,
        fees
    );
    
    // Update UI with results
    regularPaymentElement.textContent = formatCurrency(result.regularPayment);
    balloonAmountElement.textContent = formatCurrency(result.balloonAmount);
    totalRepaymentsElement.textContent = formatCurrency(result.totalRepayments);
    totalInterestElement.textContent = formatCurrency(result.totalInterest);
    totalCostElement.textContent = formatCurrency(result.totalCost);
    
    // Update chart
    updateChart(result.schedule, result.periodsPerYear, result.totalPeriods);
    
    // Update amortization table
    updateAmortizationTable(result.schedule, paymentFrequency);
    
    // Show results container
    resultsContainer.classList.remove('hidden');
    
    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
};
