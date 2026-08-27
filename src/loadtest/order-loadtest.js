import http from "k6/http";
import { check } from "k6";

export const options = {
    scenarios: {
    orders: {
        executor: "shared-iterations",
        vus: 1,
        iterations: 1,
    },
},

    thresholds: {
        http_req_duration: ["p(95)<1000"],
        http_req_failed: ["rate<0.01"],
    },
};

const URL = "http://localhost:3000/api/order/place";

const SELLER_ID = "6a2c21985de3b40a75cf8d6b";
const TABLE_ID = "6a3bca313b04ef6ac934791c";
const PRODUCT_ID = "6a2d31e5ea4652ac304d514e";

export default function () {
    const payload = JSON.stringify({
        sellerId: SELLER_ID,
        tableId: TABLE_ID,

        items: [
            {
                productId: PRODUCT_ID,
                quantity: 1,
            },
        ],
    });

    const response = http.post(URL, payload, {
    headers: {
        "Content-Type": "application/json",
    },
});

console.log(`STATUS: ${response.status}`);
console.log(`BODY: ${response.body}`);

check(response, {
    "order created": (r) => r.status === 201,
});
}