(function () {
  const ORDER_DATE_KEY = "food_palace_order_date";
  const ORDER_COUNT_KEY = "food_palace_order_count";
  const ORDER_SNAPSHOT_KEY = "food_palace_last_order";
  const ALL_ORDERS_KEY = "food_palace_all_orders";

  function hasSupabase() {
    return Boolean(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);
  }

  function sbHeaders() {
    return {
      "apikey": window.SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${window.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    };
  }

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function nextLocalOrderNumber() {
    const today = todayISO();
    const prevDate = localStorage.getItem(ORDER_DATE_KEY);
    if (prevDate !== today) {
      localStorage.setItem(ORDER_DATE_KEY, today);
      localStorage.setItem(ORDER_COUNT_KEY, "0");
    }
    let count = parseInt(localStorage.getItem(ORDER_COUNT_KEY) || "0", 10);
    count += 1;
    localStorage.setItem(ORDER_COUNT_KEY, String(count));
    return { order_no: count, order_date: today };
  }

  function saveSnapshot(items, meta) {
    localStorage.setItem(ORDER_SNAPSHOT_KEY, JSON.stringify({ items, meta }));
  }

  function saveToAllOrders(orderMeta, items) {
    try {
      const allOrders = JSON.parse(localStorage.getItem(ALL_ORDERS_KEY) || "[]");
      // Add more fields for admin display
      const fullMeta = {
        ...orderMeta,
        status: oStatus(orderMeta.status),
      };
      allOrders.unshift({ meta: fullMeta, items: items, status: fullMeta.status });
      localStorage.setItem(ALL_ORDERS_KEY, JSON.stringify(allOrders));
    } catch (e) {
      console.error("Local order save failed", e);
    }
  }

  function oStatus(status) {
    return status || "Cooking";
  }

  async function createOrder({ customerName, customerPhone, bookingType, items, subtotal, tax, total, utr, arrivalTime }) {
    if (hasSupabase()) {
      const rpcUrl = `${window.SUPABASE_URL}/rest/v1/rpc/create_order_with_items`;
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: sbHeaders(),
        body: JSON.stringify({
          p_customer_name: customerName,
          p_customer_phone: customerPhone,
          p_booking_type: bookingType,
          p_items: items,
          p_subtotal: subtotal,
          p_tax: tax,
          p_total: total,
          p_utr: utr,
          p_arrival_time: arrivalTime
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase RPC failed: ${res.status} ${text}`);
      }

      const data = await res.json();
      const row = Array.isArray(data) ? data[0] : data;
      const meta = {
        ...row,
        customer_name: customerName,
        customer_phone: customerPhone
      };
      saveSnapshot(items, meta);
      saveToAllOrders(meta, items);
      return {
        ...meta,
        source: "supabase"
      };
    }

    const localSeries = nextLocalOrderNumber();
    const localOrderId = `local-${Date.now()}`;
    const meta = {
      order_id: localOrderId,
      order_no: localSeries.order_no,
      order_date: localSeries.order_date,
      customer_name: customerName,
      customer_phone: customerPhone,
      booking_type: bookingType,
      utr,
      arrival_time: arrivalTime,
      subtotal,
      tax,
      total,
      status: "Cooking"
    };
    saveSnapshot(items, meta);
    saveToAllOrders(meta, items);
    return { ...meta, source: "local" };
  }

  async function getOrder(orderId) {
    if (hasSupabase() && orderId && !orderId.startsWith("local-")) {
      const url = `${window.SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_no,order_date,booking_type,subtotal,tax,total,customer_name,customer_phone,order_items(item_id,item_name,qty,unit_price,line_total,note,image_url)`;
      const res = await fetch(url, { headers: sbHeaders() });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase query failed: ${res.status} ${text}`);
      }
      const rows = await res.json();
      if (!rows.length) return null;
      const row = rows[0];
      return {
        order_id: row.id,
        order_no: row.order_no,
        order_date: row.order_date,
        booking_type: row.booking_type,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        subtotal: Number(row.subtotal),
        tax: Number(row.tax),
        total: Number(row.total),
        items: (row.order_items || []).map((x) => ({
          id: x.item_id,
          name: x.item_name,
          qty: x.qty,
          price: Number(x.unit_price),
          line_total: Number(x.line_total),
          note: x.note,
          image: x.image_url
        }))
      };
    }

    try {
      const snap = JSON.parse(localStorage.getItem(ORDER_SNAPSHOT_KEY) || "{}");
      if (!snap.meta || !Array.isArray(snap.items)) return null;
      return {
        order_id: snap.meta.order_id,
        order_no: snap.meta.order_no,
        order_date: snap.meta.order_date,
        booking_type: snap.meta.booking_type,
        customer_name: snap.meta.customer_name,
        customer_phone: snap.meta.customer_phone,
        subtotal: Number(snap.meta.subtotal || 0),
        tax: Number(snap.meta.tax || 0),
        total: Number(snap.meta.total || 0),
        items: snap.items.map((x) => ({
          id: x.id,
          name: x.name,
          qty: x.qty,
          price: Number(x.price),
          line_total: Number(x.price) * Number(x.qty),
          note: x.note,
          image: x.image
        }))
      };
    } catch (err) {
      return null;
    }
  }

  window.OrderService = {
    createOrder,
    getOrder,
    hasSupabase
  };
})();
