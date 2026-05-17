Automated Delivery Testing
Robocourier is an automated delivery testing tool
Robo Courier is a dedicated test automation tool built specifically for Uber Direct. With Robo Courier, you can automate the simulation of various delivery statuses at predefined intervals after placing an order. This invaluable tool empowers you to conduct thorough testing and meticulous validation of your integrations with Uber Direct.

This feature should not be used for stress testing.

Enabling Robo Courier
To have the Robo Courier automatically deliver your test order, include the following test_specifications object in the JSON data you POST to Create Delivery:

"test_specifications": {
    "robo_courier_specification": {
        "mode": "auto"
    }
}
Robo Courier mimics the behavior of a real world courier. When the auto variable is specified in the test_specifications object, the Robo Courier will deploy on the following schedule:

Event	Description	Example order placed at 1pm
Courier assignment	A courier is assigned to the order immediately when no pickup window (consists of pickup_ready_dt and pickup_deadline_dt) nor dropoff window (consists of dropoff_ready_dt and dropoff_deadline_dt) is set	1:00:00pm
Courier is enroute	A courier is on route to the order 30 seconds after assignment	1:00:30pm
Pickup is imminent	The courier is close to picking up the order 30 seconds after the courier is enroute	1:01:00pm
Courier picks up	The courier pickups up the order 30 seconds after pickup is imminent	1:01:30pm
Dropoff is imminent	The courier is close to dropping off the order 30 seconds after the courier pickups up the order	1:02:00pm
Courier drops off	The courier drop offs the order 30 seconds after dropoff is imminent	1:02:30pm
Note: If only pickup_ready_dt (i.e. pickup ready time) is set, the courier will be assigned at that given time. If only dropoff_ready_dt (i.e. dropoff ready time is set, the courier will be assigned 10 minutes before the dropoff window opens.

Any verification requirements specified by the delivery (e.g. signature capture, photo capture, identification verification, pincode verification, barcode scanning, sobriety check) will be completed successfully by the Robo Courier, both at pickup and dropoff. Webhooks will be sent normally as the pickup and dropoff occurs and will contain information reflecting the completed verification requirements.

If you want to set up various time-based testing scenarios, you can do so by setting the Robo Courier mode to custom:

"test_specifications": {
    "robo_courier_specification": {
        "mode": "custom",
        "enroute_for_pickup_at": "2023-07-06T05:05:01Z",
        "pickup_imminent_at": "2023-07-06T05:06:03Z",
        "pickup_at": "2023-07-06T05:07:01Z",
        "dropoff_imminent_at": "2023-07-06T05:08:01Z",
        "dropoff_at": "2023-07-06T05:08:01Z"
    }
}
For each event, you can specify the exact timestamp for when it will occur. All fields shown in the above code snippet are required in custom mode.

Field	Timestamp restrictions
enroute_for_pickup_at	If a pickup window is specified, it must occur within the pickup window. Else, must occur within 30 minutes of the order being placed
dropoff_at	Must be within 8 hours of pickup time
Create Delivery with Robo Courier - Payload example:
{
    "pickup_name": "Store Name",
    "pickup_address": "100 Maiden Ln, New York, NY 10038",
    "pickup_phone_number": "+15555555555",
    "dropoff_name": "Gordon Shumway",
    "dropoff_address": "30 Lincoln Center Plaza, New York, NY 10023",
    "dropoff_phone_number": "+15555555555",
    "manifest_items": [
        {
            "name": "Test",
            "quantity": 1,
            "size": "small"
        }
    ],
    "pickup_business_name": "Store Name",
    "pickup_latitude": 40.7066745,
    "pickup_longitude": -74.0071976,
    "pickup_notes": "Follow big green 'Pickup' signs in the parking lot",
    "pickup_verification": {
        "picture": true
    },
    "dropoff_business_name": "House of Luciano",
    "dropoff_latitude": 40.7727076,
    "dropoff_longitude": -73.9839082,
    "dropoff_notes": "Second floor, black door to the right.",
    "dropoff_seller_notes": "Fragile content - please handle the box with care during delivery.",
    "dropoff_verification": {
        "signature": true
    },
    "deliverable_action": "deliverable_action_meet_at_door",
    "manifest_reference": "REF0000002",
    "manifest_total_value": 1000,
    "undeliverable_action": "return",
    "requires_dropoff_signature": true,
    "requires_id": true,
    "tip": 500,
    "idempotency_key": "1234567890",
    "external_store_id": "my_store_123",
    "return_verification": {
        "signature": true,
        "picture": true
    },
    "external_id": "string",
    "test_specifications": {
        "robo_courier_specification": {
            "mode": "auto"
        }
    }
}
Robo Courier - Webhook Example:

{
  "account_id": "",
  "batch_id": "bat_3dYyXMxOW1qBNrLyqMVkUg",
  "created": "2023-08-02T14:18:21.6Z",
  "customer_id": "d80aa06f-11b5-5f8a-8d4b-601799678a42",
  "data": {
    "batch_id": "bat_3dYyXMxOW1qBNrLyqMVkUg",
    "complete": false,
    "courier": {
      "img_href": "https://d1w2poirtb3as9.cloudfront.net/default.jpeg?Expires=1691029043&Signature=N~tBRp875yYALgox5AO-jkEaIQ6V-9Nq4XCJ1PH3x4l422Q0iGUeGUcK6a4MBHotxpDL~qIhDb7yqVAjosNPMK7vN~~RMCVxxYdyqNdEWBoSdkBTUDTH3XZtHaf6sZK6y8KpoUoDBmCIt3VxLmTEdxuvkPg0XVk90m-yvfBHDxyg-V4x8vUBKoqssAXOIQ~eLz2bzOH2yQFm-1gkBRS28-JT99Q-~yV4Xd1L-g3D2vYlim~1isF21vH7~LaWenhd~iDAezHfG2JZhiP0dl8KOY8FMV8rgTtyBH5~HOG-Qa0gXvBhtexgVNewRxrIUkPCvE3-J7cxVY-9xcBVtza6NQ__&Key-Pair-Id=K36LFL06Z5BT10",
      "location": {
        "lat": 40.706913,
        "lng": -74.00695
      },
      "location_description": "",
      "name": "Alex I.",
      "phone_number": "+19294164877",
      "rating": "5.00",
      "vehicle_color": "white",
      "vehicle_make": "Toyota",
      "vehicle_model": "Prius",
      "vehicle_type": "car"
    },
    "courier_imminent": false,
    "created": "2023-08-02T14:16:48.067Z",
    "currency": "usd",
    "deliverable_action": "deliverable_action_meet_at_door",
    "dropoff": {
      "address": "30 Lincoln Center Plaza, New York, NY 10023",
      "detailed_address": {
        "city": "New York",
        "country": "US",
        "state": "",
        "street_address_1": "30 Lincoln Center Plaza",
        "street_address_2": "",
        "zip_code": "10023"
      },
      "location": {
        "lat": 40.77271,
        "lng": -73.98391
      },
      "name": "Gordon S.",
      "notes": "Second floor, black door to the right.",
      "phone_number": "+15555555555",
      "verification": {
        "identification": {
          "min_age_verified": false
        },
        "signature": {
          "image_url": ""
        }
      },
      "verification_requirements": {
        "identification": {
          "min_age": 21
        },
        "signature": true,
        "signatureRequirement": {
          "collect_signer_name": false,
          "collect_signer_relationship": false,
          "enabled": true
        }
      }
    },
    "dropoff_deadline": "2023-08-02T16:03:22Z",
    "dropoff_eta": "2023-08-02T15:20:00.03Z",
    "dropoff_ready": "2023-08-02T14:16:48Z",
    "external_id": "string",
    "fee": 2134,
    "id": "del_CvvPBsW_RVSFPdk74cD6Pg",
    "kind": "delivery",
    "live_mode": false,
    "manifest": {
      "description": "1 X Test\n",
      "reference": "REF0000002",
      "total_value": 1000
    },
    "manifest_items": [
      {
        "dimensions": {
          "depth": 15,
          "height": 7,
          "length": 20
        },
        "must_be_upright": false,
        "name": "Test",
        "price": 0,
        "quantity": 1,
        "size": "small"
      }
    ],
    "pickup": {
      "address": "100 Maiden Ln, New York, NY 10038-0001, US",
      "detailed_address": {
        "city": "New York",
        "country": "US",
        "state": "NY",
        "street_address_1": "100 Maiden Ln",
        "street_address_2": "",
        "zip_code": "10038-0001"
      },
      "external_store_id": "my_store_123",
      "location": {
        "lat": 40.706673,
        "lng": -74.007195
      },
      "name": "Store Name",
      "notes": "Follow big green 'Pickup' signs in the parking lot",
      "phone_number": "+15555555555",
      "status": "completed",
      "status_timestamp": "2023-08-02T14:18:21.447Z",
      "verification": {
        "picture": {
          "image_url": "https://tb-static.uber.com/prod/file-upload/uploads/courier-task-platform/82a0d88e-100d-40d6-a0d0-ea9c4a2e55bb"
        }
      },
      "verification_requirements": {
        "picture": true
      }
    },
    "pickup_action": "default",
    "pickup_deadline": "2023-08-02T14:36:48Z",
    "pickup_eta": "2023-08-02T14:18:21.447Z",
    "pickup_ready": "2023-08-02T14:16:48Z",
    "quote_id": "dqt_CvvPBsW_RVSFPdk74cD6Pg",
    "route_id": "rte_7mVtgY_rQOeHGgCjHqd2mg",
    "status": "dropoff",
    "tip": 500,
    "tracking_url": "https://www.ubereats.com/orders/0afbcf06-c5bf-4554-853d-d93be1c0fa3e",
    "undeliverable_action": "",
    "undeliverable_reason": "",
    "updated": "2023-08-02T14:18:21.447Z",
    "uuid": "0AFBCF06C5BF4554853DD93BE1C0FA3E"
  },
  "delivery_id": "del_CvvPBsW_RVSFPdk74cD6Pg",
  "developer_id": "",
  "id": "evt_py0BffftR_SmwvAlpSnGjg",
  "kind": "event.delivery_status",
  "live_mode": false,
  "route_id": "rte_7mVtgY_rQOeHGgCjHqd2mg",
  "status": "dropoff"
}

Cancellation reasons
The Robo Courier can also simulate delivery cancellation scenarios:

"test_specifications": {
    "robo_courier_specification": {
        "mode": "auto",
        "cancel_reason": "cannot_access_customer_location"
    }
}
Possible values for cancel_reason:

cannot_access_customer_location
cannot_find_customer_address
customer_rejected_order
customer_unavailable
When the Robo Courier navigates close to the dropoff location, you will receive a delivery status Webhook indicating courier_imminent. Then, the courier will cancel the order using the reason code specified above. You will receive a delivery status Webhook indicating cancellation.

The cancellation_reason field in the Webhook will be populated with the reason code specified. No dropoff verification actions (e.g. ID verification, signature) will be performed.

Undeliverable actions
When you initially call Create Delivery, you can specify the undeliverable_action the courier should take if the order is canceled:

Undeliverable Action	Description of Behavior
leave_at_door	Courier leaves delivery at door.
return	Courier returns delivery to store. A return trip is created automatically and assigned to that courier. The courier will return the item(s) to the pickup address. You will receive additional webhook notifications for tracking the return trip.
If you do not specify an undeliverable_action in your Create Delivery request, the default action is to return.

When you receive the cancellation webhook, this value will be sent back to you. It includes the undeliverable_action field, which will be populated with the value you specified (or left blank if you omitted it).

FAQ for Robo Courier
Does the Robo Courier follow a real route from the Pickup location to the Dropoff location?

No, the Robo Courier does not navigate street-by-street from Pickup to Dropoff. Instead, it “teleports”:

When the order is received, the Robo Courier appear at a randomly selected location near the pickup address, so it can take the delivery.
When the pickup_imminent time hits, the courier is directly placed at the pickup address.
When the dropoff_imminent time hits, the courier is directly placed at the dropoff address.
Do we only get delivery_status events for test deliveries using Robo Courier, or do we get courier_update webhook events as well?

You will receive both types of events as long as you are subscribed to them. However, for courer_update events, the courier lat/long locations will be fixed to one of the three locations mentioned above (first random location, pickup location, or dropoff location).

Are there any other known limitations to the Robo Courier?

No support for Parking Bay Check-in (the courier_check_in delivery status event)
No batching (having a single Robo Courier pickup/dropoff multiple orders at a time)
Can I still do manual testing (via the Driver app)?

Yes, Robo Courier will only be triggered when the test_specifications attribute is sent in a Create Delivery request. If you want to manually test a delivery, omit this attribute from your request
