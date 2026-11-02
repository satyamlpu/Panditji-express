"""Panditji Express marketplace (ride-hailing-style pandit booking).

A Phase-1 implementation of the SRS: accounts (customer/pandit + staff roles),
partner onboarding & verification, availability, discovery, and the booking +
dispatch state machine with concurrency-safe assignment. Built on the existing
FastAPI foundation; geo uses lat/lng + haversine in dev (PostGIS in production).
"""
