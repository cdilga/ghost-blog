---
title: "Working From Home: 🔥💻"
description: "My journey on this path to extreme speed began when I was 13 years old, staring at the flash player loading the speed dial. Ever envious of other people in neighboring towns…"
date: 2020-07-02T11:49:00.000Z
tags: []
image: "/img/ghost/working-from-home/house-1769720925547-efa5c215.webp"
legacy: true
source: "https://chris.dilger.me/working-from-home/"
---

My journey on this path to extreme speed began when I was 13 years old, staring at the flash player loading the speed dial. Ever envious of other people in neighboring towns getting upwards of 12mbps, I began my speed hunting journey.  

Now, during the largest Working From Home experiment the world has ever seen - we are all facing the same issues

-   Low bandwidth
-   Intermittent connection problems
-   Availability of high bandwidth connections

To solve this problem, an iterative approach to purchasing networking equipment, NBN and mobile broadband as well as broadband plans.

Current state  
How to guide  
What did not work  
Improvements

## Current State

### Network Equipment

-   (Optus 4G 500GB plan)\[[https://www.optus.com.au/broadband-nbn/mobile-broadband/modems/huawei/b818](https://www.optus.com.au/broadband-nbn/mobile-broadband/modems/huawei/b818)\]
-   with a (Huawei B818 LTE Cat 19 4G Router)\[[https://yescrowd.optus.com.au/t5/Broadband-Telephony/New-Optus-supplied-Wireless-Broadband-modem-B818/m-p/596304#M60115](https://yescrowd.optus.com.au/t5/Broadband-Telephony/New-Optus-supplied-Wireless-Broadband-modem-B818/m-p/596304#M60115)\] Interesting that there is conflicting information over whether this unit has 3x3 MIMO or 4x4 MIMO, and there are plenty of quirks about it too (additional links)\[[https://whirlpool.net.au/wiki/optus\_wireless\_broadband](https://whirlpool.net.au/wiki/optus_wireless_broadband)\]

## How to Guide

## What did not work

## Future Improvements

[https://docs.netgate.com/pfsense/en/latest/routing/multi-wan.html](https://docs.netgate.com/pfsense/en/latest/routing/multi-wan.html)

```
configure
edit protocols static
set table 11 route 0.0.0.0/0 next-hop 192.168.1.1
set table 12 route 0.0.0.0/0 next-hop 192.168.8.1
exit

edit firewall modify balance
set rule 25 action modify
set rule 25 description 'Streaming Traffic to WAN1'
set rule 25 protocol all
set rule 25 state new enable
set rule 25 application category Streaming-Media
set rule 25 modify table 11

exit
commit
```

*This block of code attempts to configure pbr (policy based routing) for the Ubiquiti Edge Router X*

Network config

2x routers just balancing internal network

Connect to a Switch to allow local Switching

Configuration of the PRIVATE\_NETWORKS to make sure it's routing properly

Plan to force SSH traffic onto the static IP

Otherwise, a multiconnection VPN or similar would allow aggregation, but the overhead is too high

Incoming server requests need to be coordinated with a Dynamic DNS to programmatically update the ip routes it can point to. Using CloudFlare since it's free, can set them up as round robin or as failover. Route53 is the same, we can setup a policy to failover if it dies, which is the most important. Additionally, we can setup even more resources in the cloud env

High level sections

NAT

Wizard

Pinging faster for network quality

Changing the splits (smarter round-robin)

Getting the fastest speedtests

Huawei B181 pecularities - finding that there are several issues with the longer cables. Why? Measuring stats of dropped packets

Carrier Aggregation Tips

Why is this even possible?
