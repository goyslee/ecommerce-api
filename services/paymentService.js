//services\paymentService.js
const transactionId = '123456789'
async function simulatePayment(userId, cartId, totalPrice) {
    try {
        console.log(`Payment processed successfully for User ID: ${userId}, Cart ID: ${cartId}, Total Price: ${totalPrice}`);
        return {
            success: true,
            transactionId: transactionId
        };
    } catch (error) {
        console.error('Payment processing error:', error);
        return {
            success: false,
            error: 'Payment processing error'
        };
    }
}

module.exports = {
    simulatePayment
};
