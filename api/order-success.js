const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { session_id } = req.query;
  if (!session_id) return res.status(400).send('Missing session_id');

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items'],
    });

    if (session.payment_status !== 'paid') {
      return res.status(400).send('Payment not confirmed');
    }

    const userId = session.metadata.userId || null;
    const total = session.amount_total / 100;
    const pointsAwarded = Math.floor(total * 10);

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .upsert(
        {
          stripe_session_id: session.id,
          user_id: userId || null,
          status: 'paid',
          total,
          points_awarded: pointsAwarded,
          order_type: 'pickup',
        },
        { onConflict: 'stripe_session_id' }
      )
      .select()
      .single();

    if (orderErr) throw orderErr;

    if (session.line_items?.data?.length) {
      const items = session.line_items.data.map(li => ({
        order_id: order.id,
        name: li.description,
        price: li.price.unit_amount / 100,
        quantity: li.quantity,
      }));
      await supabase.from('order_items').insert(items);
    }

    if (userId && pointsAwarded > 0) {
      await supabase.from('loyalty_transactions').insert({
        user_id: userId,
        order_id: order.id,
        points: pointsAwarded,
        description: `Order ${order.id.slice(0, 8)} — ${pointsAwarded} points earned`,
      });
    }

    res.redirect(302, `/?order=success&points=${pointsAwarded}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Order recording failed: ' + err.message);
  }
};
