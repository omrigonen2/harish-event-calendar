# Product Requirements Document (PRD)

# Multi Tenant AI Powered City Events Calendar Platform

## Version

1.0

## Document Owner

Product Team

---

# 1. Overview

The City Events Calendar is a cloud based SaaS platform allowing municipalities, organizations, tourism boards, community centers, universities and commercial organizations to publish, manage and distribute events through a modern multilingual calendar.

Each customer (Tenant) owns an independent calendar with its own:

* Branding
* Users
* Categories
* AI configuration
* Languages
* Permissions
* Events

The platform is designed as Mobile First while providing a complete desktop administration interface.

---

# 2. Goals

Primary goals

* Simple event publishing
* Excellent mobile experience
* AI assisted content creation
* AI assisted multilingual translation
* Multi tenant architecture
* Enterprise grade permission management
* API ready architecture

Future goals

* Public event websites
* Native mobile apps
* Ticket integrations
* Calendar subscriptions
* Marketing automation

---

# 3. Target Users

### Platform Super Admin

Responsible for the entire SaaS platform.

Permissions

* Create tenants
* Suspend tenants
* Manage subscriptions
* Global analytics
* Platform settings

---

### Tenant Manager

Represents a municipality or organization.

Permissions

* Full calendar access
* Create and edit all events
* Manage users
* Manage categories
* Manage audiences
* Manage languages
* Configure AI
* Configure calendar settings
* View reports

---

### Content Editor

Permissions

* Create events
* Edit only own events
* Delete own draft events
* Submit for publication (optional workflow)
* Generate AI translations
* Upload images

Cannot

* Manage users
* Edit calendar settings
* View other editors' events

---

# 4. Multi Tenant Architecture

Each tenant has complete isolation.

Tenant contains

* Calendar
* Branding
* Domain
* Categories
* Audiences
* Languages
* AI configuration
* Users
* Events
* Images
* Analytics

No data sharing between tenants.

---

# 5. Multi Language

Initial languages

* Hebrew (Default)
* English
* Spanish
* Russian

Architecture must support unlimited future languages.

Every event contains independent translations.

Example

Hebrew

Title

Description

English

Title

Description

Spanish

Title

Description

Russian

Title

Description

Missing translations are clearly indicated.

---

# 6. Event Model

Every event contains

## General

* Event ID
* Status
* Draft
* Published
* Archived
* Created By
* Created Date
* Last Modified

---

## Content

### Title

Required

Supports multiple languages

---

### Description

Rich text editor

Supports

* Headings
* Lists
* Links
* Images
* Videos
* Embedded maps

Supports multiple languages

---

## Date & Time

Required

Fields

* Start Date
* Start Time
* Optional End Date
* Optional End Time

Future support

* Multi day events
* Recurring events

---

## Images

One Cover Image

Additional Gallery Images

Features

* Drag and Drop upload
* Crop
* Resize
* Automatic optimization
* Mobile responsive

---

## Audience

Multiple audiences allowed.

Examples

* Children
* Families
* Adults
* Teenagers
* Seniors
* Tourists
* Business
* Students

Managed per tenant.

---

## Categories

Each tenant defines unlimited categories.

Examples

* Sports
* Music
* Culture
* Education
* Workshops
* Community
* Festivals

Events can belong to multiple categories.

---

## Pricing

Fields

Free Event

or

Paid Event

If paid

* Price
* Currency

Future

Ticket URL

---

## Optional Future Fields

* Venue
* GPS Coordinates
* Registration URL
* Contact Person
* Phone
* Email
* Organizer
* Tags
* Accessibility
* Parking Information
* Social Sharing Image

---

# 7. Calendar Settings

Each tenant configures

General

* Calendar Name
* Description
* Logo
* Primary Color
* Secondary Color

Localization

* Default Language
* Supported Languages
* Time Zone
* Date Format

Categories

Audience Types

Image Sizes

SEO

AI Settings

---

# 8. AI Configuration

Configured per tenant.

Settings

OpenAI API Key

Model Selector

When API key is entered

System retrieves available models.

Manager selects preferred model.

Future support

* OpenAI
* Azure OpenAI
* Anthropic
* Gemini

---

# 9. AI Translation

Available on every event.

Manager or editor clicks

Translate

Choose

* Source Language
* Target Languages

System translates

* Title
* Description

Images remain unchanged.

Translation preview shown before saving.

User can edit manually afterwards.

---

# 10. AI Marketing Message Generator

Managers can generate promotional content using AI.

Inputs

Date Range

Audience

Categories

Optional keywords

Selected language

Platform

Examples

Facebook

Instagram

WhatsApp

Newsletter

Website

SMS

Custom

Prompt

Tenant defines default AI prompt.

Example

"You are the official marketing assistant of Harish Municipality. Generate an engaging community announcement highlighting family activities while maintaining an official municipality tone."

System sends

Prompt

*

Matching events

*

Language

Output examples

Facebook Post

Instagram Caption

WhatsApp Message

Email Newsletter

Website Article

Multiple versions can be generated.

---

# 11. Search & Filtering

Filters

Date Range

Audience

Categories

Status

Creator

Language

Price

Text Search

Sorting

Newest

Oldest

Upcoming

Alphabetical

Recently Updated

---

# 12. User Management

Manager can

Invite users

Assign roles

Deactivate users

Reset passwords

View activity

Permissions

Manager

Editor

Future

Reviewer

Translator

Publisher

---

# 13. Media Library

Tenant level library.

Features

Folders

Search

Tags

Image optimization

Duplicate detection

Usage tracking

Replace image globally

---

# 14. Dashboard

Manager Dashboard

Upcoming events

Draft events

Published events

Events this month

Popular categories

Translation status

AI usage

Editors activity

Content completion

---

# 15. Public Calendar

Responsive website

Views

Month

Week

Day

Agenda

List

Cards

Users can

Search

Filter

View details

Share

Add to Calendar

Register

Future

Favorites

Nearby events

---

# 16. Responsive Design

Desktop

Complete administration

Tablet

Optimized management

Mobile

Content editing

Image upload

Event approval

Public browsing

All features available.

---

# 17. Notifications

Email

In App

Future

Push

WhatsApp

Slack

Examples

New event published

Translation completed

AI generation completed

User invited

---

# 18. Security

Tenant isolation

Role based permissions

Audit log

Encrypted API keys

Secure image storage

Rate limiting

Session management

Activity history

---

# 19. Audit Log

Every important action stored.

Examples

Event created

Event edited

Translation executed

User invited

Category deleted

AI configuration changed

---

# 20. API

REST API

Future GraphQL

Endpoints

Events

Categories

Audiences

Users

Images

Translations

Calendar

Authentication

Webhook support

---

# 21. Non Functional Requirements

Fast loading

Responsive UI

WCAG accessibility

SEO friendly

CDN image delivery

Horizontal scalability

Cloud native

Multi region ready

High availability

Automatic backups

---

# 22. Future Roadmap

Phase 2

Recurring events

Venues

Maps

Event registration

QR codes

Import from Excel

Export

RSS

ICS feeds

Google Calendar synchronization

Apple Calendar synchronization

Social scheduling

Analytics dashboard

Event approval workflow

Custom event fields

Custom branding themes

White label domains

Native mobile applications

Push notifications

AI image generation for events

AI event summaries

AI duplicate event detection

Automatic event tagging

Automatic audience classification

Recommendation engine

Event popularity prediction

Sponsor management

Volunteer management

Ticketing integrations

Marketplace integrations

CRM integrations

Webhook automation

Marketing automation

Email campaign builder

SMS campaign builder

WhatsApp campaign builder
