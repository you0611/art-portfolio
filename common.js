const asset = (name) => `assets/${name}`;

const translations = {
  zh: {
    brandName: "游祥龙艺术工作室",
    brandSub: "油画 · 风景 · 人物",
    navGallery: "作品",
    navArtist: "艺术家",
    navContact: "收藏咨询",
    navContactInfo: "联系方式",
    navActivity: "活动资讯",
    navAdmin: "管理",
    heroKicker: "Contemporary Chinese Oil Painting",
    heroTitle: "游祥龙",
    heroText: "在江南水色与人物叙事之间，记录时间、乡土与人的精神轮廓。",
    heroRecord: "中国美术家协会会员 · 深圳大芬艺术社区",
    viewWorks: "浏览作品",
    meetArtist: "了解艺术家",
    galleryKicker: "Selected Works",
    galleryTitle: "作品收藏",
    searchPlaceholder: "搜索标题、系列、年份",
    allWorks: "全部作品",
    availableOnly: "可咨询",
    soldOnly: "已收藏",
    backToWorks: "返回作品",
    artistKicker: "Artist",
    artistName: "游祥龙",
    artistBio:
      "中国美术家协会会员，中国民族画院聘用画家、研究员，广东省美术家协会会员。作品曾在国展中屡次获奖，并被贵州美术馆、江苏美术馆、北京民族文化宫、尹山湖美术馆、大芬美术馆、李自健美术馆等收藏。",
    artistStatement: "以江南水色、人物叙事与民族记忆，展开当代中国油画的个人表达。",
    proofMember: "中国美术家协会新会员名单",
    proofMinority: "《笙声不息》全国少数民族美术作品展初评入围",
    proofDafen: "《笙声不息（二）》深圳大芬国际油画双年展入选",
    contactKicker: "Acquisition Inquiry",
    contactTitle: "作品收藏咨询",
    contactText:
      "选择想了解的作品并留下联系方式，工作室会依据作品状态与你进一步沟通。提交后会生成一个咨询编号，记录保存在服务端后台。",
    contactProcess: "提交后，工作室会先确认作品状态，再与你沟通收藏方式；运输与付款会另行协商。",
    formWork: "咨询作品",
    formName: "姓名",
    formContact: "联系方式（电话 / 微信 / 邮箱）",
    formMessage: "留言",
    submitInquiry: "提交咨询",
    adminKicker: "Management",
    adminTitle: "网站管理",
    tabWorks: "作品管理",
    tabArtist: "内容资料",
    tabPeople: "履历与动态",
    tabInquiries: "咨询记录",
    tabOrders: "商务咨询",
    titleZh: "中文标题",
    titleEn: "英文标题",
    category: "系列/类别",
    medium: "媒介",
    size: "尺寸",
    year: "年份",
    price: "议价金额（人民币元）",
    workListTitle: "作品列表",
    workSearchPlaceholder: "搜索作品名称、系列或年份",
    allWorkSeries: "全部系列",
    allWorkStatuses: "全部销售状态",
    workResultCount: "共 {count} 件",
    workPageStatus: "第 {page} / {pages} 页",
    previousPage: "上一页",
    nextPage: "下一页",
    currency: "币种",
    status: "销售状态",
    contentStatus: "展示状态",
    hidePrice: "仅私下报价",
    imagePath: "图片路径",
    mediaManagerTitle: "作品主图",
    mediaLegacyActive: "当前使用项目内静态图片。",
    mediaMissing: "当前没有作品图片。",
    mediaStoredActive: "当前使用已上传图片：{name} · {width}×{height} · {size}",
    mediaUploadHint: "JPEG、PNG 或 WebP，最大 10 MB；系统会验证真实类型和图片尺寸。旧图不会删除。",
    chooseMedia: "选择新图片",
    uploadMedia: "上传并替换",
    restoreMedia: "恢复上一张",
    mediaUploading: "正在验证并上传图片…",
    mediaUploaded: "作品主图已替换，旧图仍可恢复。",
    mediaRestored: "已恢复上一张作品主图。",
    mediaFileRequired: "请先选择一张图片。",
    mediaInvalid: "图片未通过安全校验，请使用有效的 JPEG、PNG 或 WebP，并确认不超过 10 MB。",
    mediaStorageUnavailable: "本地图片存储尚未启动，请重新启动本地预览后再试。",
    mediaIntegrityTitle: "图片一致性",
    mediaIntegrityHint: "只读检查数据库记录与私有图片存储，不会删除或修改任何内容。",
    mediaIntegrityIdle: "尚未检查。",
    checkMediaIntegrity: "检查图片一致性",
    mediaIntegrityChecking: "正在核对数据库与图片存储…",
    mediaIntegrityHealthy: "检查通过：数据库 {database} 条，存储桶 {bucket} 个，没有发现差异。",
    mediaIntegrityIssues: "发现 {count} 类差异；系统没有自动删除或修改任何内容。",
    mediaIntegrityFailed: "检查失败，请确认网络与后台身份后重试。",
    mediaIssueMissing: "数据库记录缺少对应图片：{count}",
    mediaIssueOrphan: "存储桶存在未登记图片：{count}",
    mediaIssueUnlinked: "启用但未关联作品的图片：{count}",
    mediaIssueInvalidReference: "作品引用状态异常：{count}",
    negotiationEnabled: "启用议价",
    descriptionZh: "中文简介",
    descriptionEn: "英文简介",
    saveWork: "保存作品",
    newWork: "清空表单",
    artistNameLabel: "艺术家姓名",
    artistBioZh: "中文简介",
    artistBioEn: "英文简介",
    portraitUpload: "上传肖像",
    saveArtist: "保存艺术家资料",
    personName: "人员姓名",
    personRole: "角色",
    addPerson: "添加人员",
    footerText: "游祥龙艺术工作室",
    footerAdmin: "进入管理",
    available: "可咨询",
    held: "暂不可咨询",
    sold: "已收藏",
    not_for_sale: "状态待确认",
    unconfirmed: "状态待确认",
    imagePending: "图片待补",
    draft: "草稿",
    private: "不公开",
    priceOnRequest: "价格请咨询",
    inquiry: "咨询收藏",
    edit: "编辑",
    remove: "删除",
    empty: "暂无内容",
    galleryEmpty: "没有符合当前条件的作品，请调整筛选。",
    saved: "已保存",
    inquirySending: "正在提交咨询…",
    inquirySaved: "咨询已提交，编号：",
    inquiryFailed: "提交失败，请检查网络后重试；再次提交相同内容不会重复创建咨询。",
    inquiryTimeout: "提交等待超时，请直接重试；相同内容会沿用原咨询请求，不会重复创建。",
    noAvailableWorks: "当前暂无可咨询作品",
    administrator: "管理员",
    editor: "编辑",
    viewer: "查看者",
    noInquiries: "还没有咨询记录。",
    noOrders: "还没有服务端咨询。",
    noMatchingOrders: "当前筛选下没有咨询。",
    adminOrdersNotice: "这里是服务端咨询与议价流程；旧浏览器里的咨询记录不会自动迁移。",
    followUpFilter: "跟进筛选",
    allFollowUps: "全部跟进",
    followUpStatus: "跟进状态",
    nextFollowUpAt: "下一次跟进时间",
    adminNote: "管理员备注",
    saveFollowUp: "保存跟进",
    orderSort: "排序",
    sortFollowUp: "按跟进时间",
    sortUpdated: "按最近更新",
    sortCreated: "按创建时间",
    contacting: "沟通中",
    completed: "已完成",
    notificationEvents: "内部通知事件（仅记录，不发送外部消息）",
    noNotificationEvents: "暂无通知事件。",
    notificationEventRecorded: "已记录",
    notificationEventFailed: "记录失败",
    localEmailOutbox: "本地邮件出站（假发送）",
    gmailEmailOutbox: "Gmail 邮件出站（真实投递）",
    dispatchEmailOutbox: "模拟投递",
    dispatchEmailOutboxReal: "投递邮件",
    emailOutboxEmpty: "暂无邮件出站记录。",
    emailOutboxLoadFailed: "邮件出站读取失败，请重新加载咨询后重试。",
    emailOutboxNetworkFailed: "当前网络不可用，邮件出站状态未更新；请恢复网络后重新加载。",
    emailOutboxTimeout: "邮件出站读取超时，当前显示不是最新状态；请重新加载。",
    emailDispatchResult: "模拟投递完成：",
    emailDispatchResultReal: "Gmail 投递完成：",
    adminRecipient: "管理员邮箱",
    customerRecipient: "客户邮箱",
    sent: "已发送（模拟）",
    sentReal: "已发送",
    skipped: "已跳过",
    inquiry_admin: "新咨询通知",
    customer_offer_admin: "客户报价通知",
    admin_offer_customer: "管理员报价通知",
    new_inquiry: "新咨询",
    new_offer: "新报价",
    order_status_changed: "订单阶段变化",
    ordersLoading: "正在读取服务端咨询…",
    ordersReady: "服务端咨询已加载。",
    selectOrder: "请选择一条咨询",
    customer: "客户",
    orderStatus: "订单阶段",
    selectNextOrderStatus: "请选择下一阶段",
    cancelledOrderReadonly: "已取消咨询仅可查看，不能恢复或继续推进。",
    orderStatusInvalid: "这个阶段转换不符合当前流程，请选择允许的下一阶段。",
    offerAmount: "报价金额（人民币元）",
    offerMessage: "报价说明",
    sendOffer: "发送报价",
    holdOffer: "接受哪一份报价",
    holdDuration: "占用时长（分钟）",
    createHold: "接受报价并占用作品",
    releaseHold: "释放作品占用",
    updateOrderStatus: "更新阶段",
    submitOrderStatus: "保存阶段",
    submitted: "新咨询",
    unprocessed: "未处理",
    negotiating: "议价中",
    awaiting_payment: "待线下付款确认",
    cancelled: "已取消",
    pending: "待处理",
    accepted: "已接受",
    rejected: "已拒绝",
    withdrawn: "已撤回",
    expired: "已过期",
    customerOffer: "客户报价",
    adminOffer: "管理员报价",
    published: "已发布",
    archived: "已归档",
    not_for_sale: "不出售",
    adminLoading: "正在读取服务端作品…",
    adminReady: "服务端作品已加载。",
    adminSaved: "作品已保存到服务端。",
    contentLoading: "正在读取网站内容…",
    contentReady: "网站内容已加载。",
    contentSaved: "网站内容已保存到服务端。",
    contentRestored: "已恢复上一版内容。",
    contentLoadFailed: "网站内容读取失败，请重试。",
    contentProfileTitle: "核心文案",
    contentProfileHint: "修改会同步到公开页面；每次保存都会保留上一版，可立即恢复。",
    restorePrevious: "恢复上一版",
    entryManagerTitle: "履历与动态",
    entryManagerHint: "现有履历来自网站代码；活动、人物和合作资料须有可靠来源后再发布。归档内容不会公开，但仍可核查。",
    entryKind: "内容类型",
    timelineEntry: "展览履历",
    activityEntry: "活动资讯",
    personEntry: "人物资料",
    collaborationEntry: "合作资料",
    yearLabel: "年份 / 日期",
    entryTitleZh: "中文标题（履历可留空）",
    entryTitleEn: "英文标题（履历可留空）",
    entryBodyZh: "中文内容",
    entryBodyEn: "英文内容",
    sourceUrl: "来源链接（可选，仅 HTTPS）",
    displayOrder: "显示顺序",
    saveEntry: "保存条目",
    newEntry: "新建条目",
    archiveEntry: "归档",
    sourceLink: "查看来源",
    profileHeroSection: "首页说明",
    profileArtistSection: "艺术家资料",
    profileContactSection: "咨询与联系文案",
    profileActivitySection: "活动页说明",
    adminWorkEditOnly: "本阶段只支持编辑已有作品；新增作品留待后续阶段。",
    adminLegacyNotice: "旧本地功能 / 本阶段未迁移：内容仍只保存在当前浏览器，不代表跨设备保存。",
    adminAccessUnavailable: "后台身份验证或服务端暂不可用，请确认已通过 Cloudflare Access。",
    adminNetworkUnavailable: "当前网络不可用，数据没有保存；恢复网络后可直接重试。",
    adminRequestTimeout: "请求等待超时，结果尚未确认；请先重新加载数据，再决定是否重试。",
    reloadWorks: "重新加载作品",
    reloadOrders: "重新加载咨询",
    adminVersionConflict: "数据已被其他修改刷新，请重新加载",
    adminSaveFailed: "保存失败，请稍后重试。",
    honorsTitle: "展览荣誉",
    timelineHint: "左右滑动查看更多",
    contactPhone: "电话",
    contactAddress: "画廊地址",
    contactInfoKicker: "Contact",
    contactInfoTitle: "联系方式",
    contactInfoText: "欢迎致电或到访工作室，了解作品收藏与艺术交流。",
    activityKicker: "Studio Updates",
    activityTitle: "活动资讯",
    activityIntro: "这里将发布工作室展览、交流与公共活动的最新消息。",
    activityEmpty: "暂无活动资讯，敬请关注。",
    backHome: "返回主站",
    moreWorks: "了解更多",
  },
  en: {
    brandName: "You Xianglong Art Studio",
    brandSub: "Oil Painting · Landscape · Figure",
    navGallery: "Works",
    navArtist: "Artist",
    navContact: "Inquiry",
    navContactInfo: "Contact",
    navActivity: "News & Events",
    navAdmin: "Admin",
    heroKicker: "Contemporary Chinese Oil Painting",
    heroTitle: "You Xianglong",
    heroText: "Between Jiangnan waterscapes and human narratives, the paintings trace memory, place, and spirit.",
    heroRecord: "Member of the China Artists Association · Shenzhen Dafen art community",
    viewWorks: "View Works",
    meetArtist: "Meet the Artist",
    galleryKicker: "Selected Works",
    galleryTitle: "Collection",
    searchPlaceholder: "Search title, series, year",
    allWorks: "All works",
    availableOnly: "Available",
    soldOnly: "Collected",
    backToWorks: "Back to works",
    artistKicker: "Artist",
    artistName: "You Xianglong",
    artistBio:
      "You Xianglong is a member of the China Artists Association, a painter and researcher of the China National Art Institute, and a member of the Guangdong Artists Association. His works have received national exhibition awards and entered public and private collections.",
    artistStatement: "A personal language of contemporary Chinese oil painting shaped by Jiangnan waterscapes, human narratives, and cultural memory.",
    proofMember: "Listed among the China Artists Association's new members",
    proofMinority: "Lusheng Sound Never Ends shortlisted for the National Minority Art Exhibition",
    proofDafen: "Lusheng Sound Never Ends II selected for the Shenzhen Dafen International Oil Painting Biennale",
    contactKicker: "Acquisition Inquiry",
    contactTitle: "Acquisition Inquiry",
    contactText:
      "Select a work and leave your contact details. The studio will follow up according to its current availability. A reference is created and the inquiry is stored on the server.",
    contactProcess: "After you submit, the studio will confirm availability and discuss the collecting process with you; shipping and payment are arranged separately.",
    formWork: "Work",
    formName: "Name",
    formContact: "Contact (phone / WeChat / email)",
    formMessage: "Message",
    submitInquiry: "Submit Inquiry",
    adminKicker: "Management",
    adminTitle: "Site Admin",
    tabWorks: "Works",
    tabArtist: "Site content",
    tabPeople: "Records & updates",
    tabInquiries: "Inquiries",
    tabOrders: "Business inquiries",
    titleZh: "Chinese title",
    titleEn: "English title",
    category: "Series / Category",
    medium: "Medium",
    size: "Size",
    year: "Year",
    price: "Negotiation amount (CNY yuan)",
    workListTitle: "Artwork list",
    workSearchPlaceholder: "Search title, series, or year",
    allWorkSeries: "All series",
    allWorkStatuses: "All sale statuses",
    workResultCount: "{count} works",
    workPageStatus: "Page {page} of {pages}",
    previousPage: "Previous",
    nextPage: "Next",
    currency: "Currency",
    status: "Sale status",
    contentStatus: "Content status",
    hidePrice: "Private quote only",
    imagePath: "Image path",
    mediaManagerTitle: "Primary artwork image",
    mediaLegacyActive: "The bundled static image is currently active.",
    mediaMissing: "This artwork does not currently have an image.",
    mediaStoredActive: "Uploaded image: {name} · {width}×{height} · {size}",
    mediaUploadHint: "JPEG, PNG, or WebP, up to 10 MB. File contents and dimensions are verified; the previous image is retained.",
    chooseMedia: "Choose a new image",
    uploadMedia: "Upload and replace",
    restoreMedia: "Restore previous image",
    mediaUploading: "Validating and uploading the image…",
    mediaUploaded: "Primary image replaced. The previous image remains available for restore.",
    mediaRestored: "Previous primary image restored.",
    mediaFileRequired: "Choose an image first.",
    mediaInvalid: "The image failed validation. Use a valid JPEG, PNG, or WebP no larger than 10 MB.",
    mediaStorageUnavailable: "Local media storage is not running. Restart the local preview and try again.",
    mediaIntegrityTitle: "Image integrity",
    mediaIntegrityHint: "Read-only comparison of database records and private image storage. Nothing is deleted or changed.",
    mediaIntegrityIdle: "Not checked yet.",
    checkMediaIntegrity: "Check image integrity",
    mediaIntegrityChecking: "Comparing the database and image storage…",
    mediaIntegrityHealthy: "Check passed: {database} database records and {bucket} stored objects, with no differences.",
    mediaIntegrityIssues: "Found {count} issue categories. Nothing was deleted or changed automatically.",
    mediaIntegrityFailed: "The check failed. Confirm the network and administrator session, then try again.",
    mediaIssueMissing: "Database records with missing images: {count}",
    mediaIssueOrphan: "Stored images without database records: {count}",
    mediaIssueUnlinked: "Active images not linked to an artwork: {count}",
    mediaIssueInvalidReference: "Artwork references with an invalid state: {count}",
    negotiationEnabled: "Negotiation enabled",
    descriptionZh: "Chinese description",
    descriptionEn: "English description",
    saveWork: "Save work",
    newWork: "Clear form",
    artistNameLabel: "Artist name",
    artistBioZh: "Chinese bio",
    artistBioEn: "English bio",
    portraitUpload: "Upload portrait",
    saveArtist: "Save artist profile",
    personName: "Name",
    personRole: "Role",
    addPerson: "Add person",
    footerText: "You Xianglong Art Studio",
    footerAdmin: "Open admin",
    available: "Available",
    held: "Temporarily unavailable",
    sold: "Collected",
    not_for_sale: "Status pending",
    unconfirmed: "Status pending",
    imagePending: "Image pending",
    draft: "Draft",
    private: "Private",
    priceOnRequest: "Price on request",
    inquiry: "Inquire",
    edit: "Edit",
    remove: "Delete",
    empty: "Nothing here yet",
    galleryEmpty: "No works match these filters. Try a different selection.",
    saved: "Saved",
    inquirySending: "Submitting inquiry…",
    inquirySaved: "Inquiry submitted. Reference: ",
    inquiryFailed: "Submission failed. Check your connection and retry; the same content will not create a duplicate inquiry.",
    inquiryTimeout: "The request timed out. Retry directly; the same content will reuse the original inquiry request.",
    noAvailableWorks: "No works are currently open for inquiry",
    administrator: "Administrator",
    editor: "Editor",
    viewer: "Viewer",
    noInquiries: "No inquiries yet.",
    noOrders: "No server inquiries yet.",
    noMatchingOrders: "No inquiries match the current filter.",
    adminOrdersNotice: "This panel contains server-backed inquiries and negotiation; old browser-local inquiries are not migrated.",
    followUpFilter: "Follow-up filter",
    allFollowUps: "All follow-ups",
    followUpStatus: "Follow-up status",
    nextFollowUpAt: "Next follow-up",
    adminNote: "Admin note",
    saveFollowUp: "Save follow-up",
    orderSort: "Sort",
    sortFollowUp: "Next follow-up",
    sortUpdated: "Recently updated",
    sortCreated: "Recently created",
    contacting: "Contacting",
    completed: "Completed",
    notificationEvents: "Internal notification events (recorded only; nothing is sent)",
    noNotificationEvents: "No notification events.",
    notificationEventRecorded: "Recorded",
    notificationEventFailed: "Failed",
    localEmailOutbox: "Local email outbox (fake delivery)",
    gmailEmailOutbox: "Gmail email outbox (real delivery)",
    dispatchEmailOutbox: "Run fake delivery",
    dispatchEmailOutboxReal: "Send emails",
    emailOutboxEmpty: "No email outbox records.",
    emailOutboxLoadFailed: "The email outbox could not be loaded. Reload inquiries and try again.",
    emailOutboxNetworkFailed: "The network is unavailable, so email status was not refreshed. Reconnect and reload.",
    emailOutboxTimeout: "The email outbox request timed out. The visible status may be stale; reload it.",
    emailDispatchResult: "Fake delivery complete: ",
    emailDispatchResultReal: "Gmail delivery complete: ",
    adminRecipient: "Administrator mailbox",
    customerRecipient: "Customer mailbox",
    sent: "Sent (fake)",
    sentReal: "Sent",
    skipped: "Skipped",
    inquiry_admin: "New inquiry notification",
    customer_offer_admin: "Customer offer notification",
    admin_offer_customer: "Administrator offer notification",
    new_inquiry: "New inquiry",
    new_offer: "New offer",
    order_status_changed: "Order stage changed",
    ordersLoading: "Loading server inquiries…",
    ordersReady: "Server inquiries loaded.",
    selectOrder: "Select an inquiry",
    customer: "Customer",
    orderStatus: "Order stage",
    selectNextOrderStatus: "Select the next stage",
    cancelledOrderReadonly: "Cancelled inquiries are view-only and cannot be reopened or advanced.",
    orderStatusInvalid: "That stage transition is not allowed from the current stage.",
    offerAmount: "Offer amount (CNY yuan)",
    offerMessage: "Offer note",
    sendOffer: "Send offer",
    holdOffer: "Offer to accept",
    holdDuration: "Hold duration (minutes)",
    createHold: "Accept offer and hold work",
    releaseHold: "Release work hold",
    updateOrderStatus: "Update stage",
    submitOrderStatus: "Save stage",
    submitted: "New inquiry",
    unprocessed: "Unprocessed",
    negotiating: "Negotiating",
    awaiting_payment: "Awaiting offline payment confirmation",
    cancelled: "Cancelled",
    pending: "Pending",
    accepted: "Accepted",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
    expired: "Expired",
    customerOffer: "Customer offer",
    adminOffer: "Admin offer",
    published: "Published",
    archived: "Archived",
    not_for_sale: "Not for sale",
    adminLoading: "Loading works from the server…",
    adminReady: "Server works loaded.",
    adminSaved: "Work saved to the server.",
    contentLoading: "Loading site content…",
    contentReady: "Site content loaded.",
    contentSaved: "Site content saved to the server.",
    contentRestored: "The previous version has been restored.",
    contentLoadFailed: "Site content could not be loaded. Please retry.",
    contentProfileTitle: "Core copy",
    contentProfileHint: "Changes appear on public pages. Every save keeps the prior version for immediate restore.",
    restorePrevious: "Restore previous version",
    entryManagerTitle: "Records & updates",
    entryManagerHint: "Existing records come from the site source. Publish activities, people, or collaborations only after checking a reliable source. Archived entries remain inspectable.",
    entryKind: "Content type",
    timelineEntry: "Exhibition record",
    activityEntry: "News & event",
    personEntry: "Person profile",
    collaborationEntry: "Collaboration",
    yearLabel: "Year / date",
    entryTitleZh: "Chinese title (optional for records)",
    entryTitleEn: "English title (optional for records)",
    entryBodyZh: "Chinese content",
    entryBodyEn: "English content",
    sourceUrl: "Source link (optional, HTTPS only)",
    displayOrder: "Display order",
    saveEntry: "Save entry",
    newEntry: "New entry",
    archiveEntry: "Archive",
    sourceLink: "View source",
    profileHeroSection: "Homepage copy",
    profileArtistSection: "Artist profile",
    profileContactSection: "Inquiry & contact copy",
    profileActivitySection: "Activity page copy",
    adminWorkEditOnly: "This phase edits existing works only; creating new works comes later.",
    adminLegacyNotice: "Legacy local feature / not migrated in this phase: data stays in this browser and is not cross-device storage.",
    adminAccessUnavailable: "Admin authentication or the server is unavailable. Confirm Cloudflare Access is authorized.",
    adminNetworkUnavailable: "The network is unavailable and nothing was saved. Reconnect and retry.",
    adminRequestTimeout: "The request timed out and its result is not confirmed. Reload the data before retrying.",
    reloadWorks: "Reload works",
    reloadOrders: "Reload inquiries",
    adminVersionConflict: "The data changed elsewhere. Reload before saving again.",
    adminSaveFailed: "Save failed. Please try again.",
    honorsTitle: "Exhibition Honors",
    timelineHint: "Scroll sideways to view more",
    contactPhone: "Phone",
    contactAddress: "Gallery Address",
    contactInfoKicker: "Contact",
    contactInfoTitle: "Contact",
    contactInfoText: "Call or visit the studio to discuss collecting works and artistic exchange.",
    activityKicker: "Studio Updates",
    activityTitle: "News & Events",
    activityIntro: "Studio exhibitions, exchanges, and public events will be announced here.",
    activityEmpty: "No upcoming events at the moment. Please check back soon.",
    backHome: "Back to the main site",
    moreWorks: "More Works",
  },
};

const starterState = {
  language: "zh",
  artist: {
    name: "游祥龙",
    nameEn: "You Xianglong",
    portrait: asset("artist-portrait.jpg"),
    bioZh:
      "中国美术家协会会员，中国民族画院聘用画家、研究员，广东省美术家协会会员。作品曾在国展中屡次获奖，并被贵州美术馆、江苏美术馆、北京民族文化宫、尹山湖美术馆、大芬美术馆、李自健美术馆等收藏。作品《踩芦笙》2020年获百家金陵收藏奖，《江南行》作为江苏交通版权卡出版发行。",
    bioEn:
      "You Xianglong is a member of the China Artists Association, a painter and researcher of the China National Art Institute, and a member of the Guangdong Artists Association. His oil paintings have been selected for national exhibitions, received awards, and entered institutional collections.",
  },
  timeline: [
    { year: "2026", zh: "作品《她系列八》入选中国美协新文艺群体美术作品展。", en: "She Series No. 8 selected for the China Artists Association New Literary & Art Groups Exhibition." },
    { year: "2025", zh: "作品《她系列八》参加\"东方之光\"中韩艺术交流展（韩国首尔）。", en: "She Series No. 8 shown in 'Light of the East' China-Korea Art Exchange (Seoul)." },
    { year: "2025", zh: "作品《她系列六》入选第四届深圳大芬国际油画双年展。", en: "She Series VI selected for the 4th Shenzhen Dafen International Oil Painting Biennale." },
    { year: "2024", zh: "作品《她系列七》入选\"红岩清风\"廉洁文化美术作品展。", en: "She Series VII selected for the 'Red Rock Breeze' Clean Culture Art Exhibition." },
    { year: "2024", zh: "作品《喀什大巴扎三》入选陆海之约——第十二届中国西部大地情中国画、油画作品展。", en: "Kashgar Grand Bazaar III selected for the 12th China Western Landscape Art Exhibition." },
    { year: "2023", zh: "作品《泊 NO.6》《泊 NO.8》入选\"得境取象\"第三届东亿中国油画作品展。", en: "Mooring No.6 & No.8 selected for the 3rd Dongyi China Oil Painting Exhibition." },
    { year: "2023", zh: "作品《乡情系列八》入选第二届\"华夏意韵——中国油画精品展\"。", en: "Nostalgia Series VIII selected for the 2nd Huaxia Yiyun China Oil Painting Exhibition." },
    { year: "2022", zh: "作品《高二那年》入选\"时代·肖像\"2022中国油画作品展。", en: "That Year in Grade Two selected for the 2022 Era·Portrait China Oil Painting Exhibition." },
    { year: "2022", zh: "作品《岁月静好》入选\"时代颂歌\"2022中国百家金陵油画展，入会资格。", en: "Peaceful Times selected for the 2022 Era Ode China Baijia Jinling Exhibition (membership qualification)." },
    { year: "2022", zh: "作品《笙声不息二》入选2022第三届深圳大芬国际油画双年展（馆藏）。", en: "Lusheng Sound Never Ends II selected for the 3rd Shenzhen Dafen International Oil Painting Biennale (collection)." },
    { year: "2022", zh: "作品《笙声不息》入选2022全国少数民族美术作品展，入会资格（馆藏）。", en: "Lusheng Sound Never Ends selected for the 2022 National Minority Art Exhibition (membership qualification, collection)." },
    { year: "2022", zh: "作品《她系列五》入选\"悲鸿风度\"首届油画双年展，入会资格。", en: "She Series V selected for the 1st Beihong Grace Oil Painting Biennale (membership qualification)." },
    { year: "2022", zh: "作品《红》入选\"心境物语——首届中国写意油画静物专题研究展\"（馆藏）。", en: "Red selected for the 1st Chinese Xieyi Oil Painting Still Life Exhibition (collection)." },
    { year: "2021", zh: "作品《她系列三》入选\"江南如画中国油画作品展2021\"。", en: "She Series III selected for the 2021 Jiangnan as in Painting China Oil Painting Exhibition." },
    { year: "2021", zh: "作品《她系列二》入选首届\"倪云林\"全国美术作品展（中国画、油画）。", en: "She Series II selected for the 1st Ni Yunlin National Art Exhibition." },
    { year: "2021", zh: "作品《她系列一》入选第五届\"时代之光\"中国油画展，入会资格。", en: "She Series I selected for the 5th Light of the Era China Oil Painting Exhibition (membership qualification)." },
    { year: "2020", zh: "作品《路上》入选\"第九届全国（大芬）青年油画作品展\"。", en: "On the Road selected for the 9th National (Dafen) Youth Oil Painting Exhibition." },
    { year: "2020", zh: "作品《踩芦笙》入选\"百年梦圆2020\"中国百家金陵油画作品展，获收藏奖（馆藏）。", en: "Cai Lusheng selected for the 2020 China Baijia Jinling Oil Painting Exhibition, Collection Award (collection)." },
    { year: "2019", zh: "作品《江南行》入选\"诗意大运河\"2019年全国油画作品展，入会资格（馆藏）。", en: "Journey to Jiangnan selected for the 2019 Poetic Grand Canal National Oil Painting Exhibition (membership qualification, collection)." },
    { year: "2019", zh: "作品《归去来兮》入选\"得境取象\"第二届东亿中国油画作品展。", en: "Return selected for the 2nd Dongyi China Oil Painting Exhibition." },
    { year: "2019", zh: "作品《乡情》入选徐悲鸿画院庆祝新中国成立70周年油画展。", en: "Nostalgia selected for the Xu Beihong Art Academy 70th Anniversary Oil Painting Exhibition." },
    { year: "2016", zh: "作品《传承》入选\"同心筑梦\"第二届中国民族美术双年展，入会资格（馆藏）。", en: "Inheritance selected for the 2nd China National Art Biennale (membership qualification, collection)." },
  ],
  works: [
    {
      id: "guiquilaixi", titleZh: "归去来兮", titleEn: "Return",
      category: "风景", medium: "布面油画", size: "90 × 135 cm",
      year: "2019", price: "", hidePrice: true, status: "available",
      image: asset("guiquilaixi.jpg"),
      descriptionZh: "入选\"得境取象\"第二届东亿中国油画作品展。",
      descriptionEn: "Selected for the 2nd Dongyi China Oil Painting Exhibition.",
    },
    {
      id: "shengsheng-2", titleZh: "笙声不息（二）", titleEn: "Lusheng Sound Never Ends II",
      category: "民族题材", medium: "布面油画", size: "150 × 120 cm",
      year: "2022", price: "", hidePrice: true, status: "available",
      image: asset("shengsheng-2.jpg"),
      descriptionZh: "2022年入选第三届深圳大芬国际油画双年展（馆藏）。",
      descriptionEn: "Selected for the 3rd Shenzhen Dafen International Oil Painting Biennale.",
    },
    {
      id: "shengsheng-3", titleZh: "笙声不息（三）", titleEn: "Lusheng Sound Never Ends III",
      category: "民族题材", medium: "布面油画", size: "150 × 120 cm",
      year: "2022", price: "", hidePrice: true, status: "available",
      image: asset("shengsheng-3.jpg"),
      descriptionZh: "笙声不息系列第三幅，以芦笙舞展现民族文化生命力。",
      descriptionEn: "Third in the Lusheng series, celebrating ethnic cultural vitality.",
    },
    {
      id: "chengzhongcun", titleZh: "城中村——红色记忆", titleEn: "Urban Village – Red Memory",
      category: "城市记忆", medium: "布面油画", size: "130 × 160 cm",
      year: "2020", price: "", hidePrice: true, status: "sold",
      image: asset("chengzhongcun.jpg"),
      descriptionZh: "记录城市化进程中的空间记忆与色彩张力。",
      descriptionEn: "Spatial memory and color tension in urbanization.",
    },
    {
      id: "banyan", titleZh: "池塘边的大榕树", titleEn: "Banyan by the Pond",
      category: "风景", medium: "布面油画", size: "122 × 155 cm",
      year: "2020", price: "", hidePrice: true, status: "sold",
      image: asset("banyan.jpg"),
      descriptionZh: "描绘南方乡间的静谧与生命力。",
      descriptionEn: "Serenity and vitality of the southern countryside.",
    },
    {
      id: "on-the-road", titleZh: "路上", titleEn: "On the Road",
      category: "人物与叙事", medium: "布面油画", size: "180 × 130 cm",
      year: "2020", price: "", hidePrice: true, status: "available",
      image: asset("on-the-road.jpg"),
      descriptionZh: "入选第九届全国（大芬）青年油画作品展。",
      descriptionEn: "Selected for the 9th National Youth Oil Painting Exhibition.",
    },
    {
      id: "she-series-1", titleZh: "她系列（一）", titleEn: "She Series I",
      category: "她系列", medium: "布面油画", size: "150 × 120 cm",
      year: "2020", price: "", hidePrice: true, status: "available",
      image: asset("she-series-1.jpg"),
      descriptionZh: "2021年入选第五届「时代之光」中国油画展，入会资格。",
      descriptionEn: "Selected for the 5th Light of the Era China Oil Painting Exhibition.",
    },
    {
      id: "she-series-2", titleZh: "她系列（二）", titleEn: "She Series II",
      category: "她系列", medium: "布面油画", size: "120 × 150 cm",
      year: "2020", price: "", hidePrice: true, status: "available",
      image: asset("she-series-2.jpg"),
      descriptionZh: "2021年入选首届「倪云林」全国美术作品展。",
      descriptionEn: "Selected for the 1st Ni Yunlin National Art Exhibition.",
    },
    {
      id: "she-series-3", titleZh: "她系列（三）", titleEn: "She Series III",
      category: "她系列", medium: "布面油画", size: "150 × 120 cm",
      year: "2021", price: "", hidePrice: true, status: "available",
      image: asset("she-series-3.jpg"),
      descriptionZh: "2021年入选「江南如画」中国油画作品展。",
      descriptionEn: "Selected for the 2021 Jiangnan as in Painting Exhibition.",
    },
    {
      id: "shengsheng-1", titleZh: "笙声不息（一）", titleEn: "Lusheng Sound Never Ends I",
      category: "民族题材", medium: "布面油画", size: "150 × 120 cm",
      year: "2022", price: "", hidePrice: true, status: "sold",
      image: asset("shengsheng-1.jpg"),
      descriptionZh: "2022年入选全国少数民族美术作品展，馆藏于北京民族文化宫。",
      descriptionEn: "Selected for the 2022 National Minority Art Exhibition.",
    },
    {
      id: "ta-series-5", titleZh: "她系列五", titleEn: "She Series V",
      category: "她系列", medium: "布面油画", size: "160 × 130 cm",
      year: "2021", price: "", hidePrice: true, status: "available",
      image: asset("ta-series-5.jpg"),
      descriptionZh: "2022年入选\"悲鸿风度\"首届油画双年展。",
      descriptionEn: "Selected for the 1st Beihong Grace Oil Painting Biennale.",
    },
    {
      id: "jiangnan-2024", titleZh: "江南", titleEn: "Jiangnan",
      category: "江南系列", medium: "布面油画", size: "140 × 160 cm",
      year: "2024", price: "", hidePrice: true, status: "available",
      image: asset("jiangnan-2024.jpg"),
      descriptionZh: "以江南水乡的湿润光色为线索。",
      descriptionEn: "A Jiangnan waterscape of humid light and quiet rhythm.",
    },
    {
      id: "jiangnan-series-6", titleZh: "江南系列六", titleEn: "Jiangnan Series VI",
      category: "江南系列", medium: "布面油画", size: "120 × 120 cm",
      year: "2025", price: "", hidePrice: true, status: "available",
      image: asset("jiangnan-series-6.jpg"),
      descriptionZh: "方形构图中的江南诗性秩序。",
      descriptionEn: "A square-format Jiangnan poetic order.",
    },
    {
      id: "grass-2024", titleZh: "小草", titleEn: "Grass",
      category: "人物与叙事", medium: "布面油画", size: "120 × 120 cm",
      year: "2024", price: "", hidePrice: true, status: "available",
      image: asset("grass-2024.jpg"),
      descriptionZh: "关注普通生命的韧性。",
      descriptionEn: "Resilience of ordinary life.",
    },
    {
      id: "flower-2025", titleZh: "花非花", titleEn: "Flower, Not Flower",
      category: "人物与叙事", medium: "布面油画", size: "120 × 120 cm",
      year: "2025", price: "", hidePrice: true, status: "available",
      image: asset("flower-2025.jpg"),
      descriptionZh: "在具象与意象之间展开。",
      descriptionEn: "Between figuration and suggestion.",
    },
    {
      id: "jiangnan-trip", titleZh: "江南行", titleEn: "Journey to Jiangnan",
      category: "江南系列", medium: "布面油画", size: "130 × 160 cm",
      year: "2019", price: "", hidePrice: true, status: "sold",
      image: asset("jiangnan-trip.jpg"),
      descriptionZh: "入选\"诗意大运河\"2019年全国油画作品展。",
      descriptionEn: "Selected for the 2019 Poetic Grand Canal Exhibition.",
    },
    {
      id: "cai-lusheng", titleZh: "踩芦笙", titleEn: "Cai Lusheng",
      category: "民族题材", medium: "布面油画", size: "160 × 130 cm",
      year: "2020", price: "", hidePrice: true, status: "sold",
      image: asset("cai-lusheng.jpg"),
      descriptionZh: "入选\"百年梦圆2020\"中国百家金陵油画作品展并获收藏奖。",
      descriptionEn: "Selected for the 2020 Baijia Jinling Exhibition, Collection Award.",
    },
  ],
  people: [
    { id: "p-admin", name: "站点管理员", role: "administrator" },
    { id: "p-editor", name: "作品编辑", role: "editor" },
  ],
  contentEntries: [],
  inquiries: [],
};

const DATA_VERSION = 2;
const clone = typeof structuredClone === "function" ? structuredClone : function(obj) { return JSON.parse(JSON.stringify(obj)); };

function loadState() {
  const saved = localStorage.getItem("yx-site-v2");
  const ver = localStorage.getItem("yx-ver");
  if (!saved || ver != DATA_VERSION) {
    localStorage.setItem("yx-ver", DATA_VERSION);
    return clone(starterState);
  }
  try {
    return { ...clone(starterState), ...JSON.parse(saved) };
  } catch {
    return clone(starterState);
  }
}

let state = loadState();
function saveState() {
  localStorage.setItem("yx-site-v2", JSON.stringify(state));
}

function t(key) {
  return translations[state.language][key] || translations.zh[key] || key;
}

function byId(id) {
  return document.getElementById(id);
}

function localText(item, zhKey, enKey) {
  return state.language === "zh" ? item[zhKey] || item[enKey] : item[enKey] || item[zhKey];
}

function hasArtworkImage(work) {
  return typeof work?.image === "string" && work.image.trim().length > 0;
}

function artworkImageMarkup(work, title, { eager = false, className = "" } = {}) {
  if (!hasArtworkImage(work)) {
    return `<div class="artwork-image-placeholder${className ? ` ${className}` : ""}" role="img" aria-label="${title} · ${t("imagePending")}"><span>${t("imagePending")}</span></div>`;
  }
  const loading = eager ? "eager" : "lazy";
  const classAttribute = className ? ` class="${className}"` : "";
  return `<img${classAttribute} src="${work.image}" alt="${title}" loading="${loading}" decoding="async" />`;
}

function artworkMetaText(work) {
  return [work?.category, work?.medium, work?.size, work?.year].filter(Boolean).join(" · ");
}

function applyLanguage() {
  document.documentElement.lang = state.language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  byId("languageToggle").textContent = state.language === "zh" ? "EN" : "中文";
}

function visibleWorks() {
  return state.works.filter((work) => work.status !== "private" && work.status !== "draft");
}

const PROFILE_TRANSLATION_FIELDS = {
  artistName: ["artistNameZh", "artistNameEn"],
  artistBio: ["artistBioZh", "artistBioEn"],
  artistStatement: ["artistStatementZh", "artistStatementEn"],
  heroTitle: ["heroTitleZh", "heroTitleEn"],
  heroText: ["heroTextZh", "heroTextEn"],
  heroRecord: ["heroRecordZh", "heroRecordEn"],
  contactText: ["contactTextZh", "contactTextEn"],
  contactProcess: ["contactProcessZh", "contactProcessEn"],
  contactInfoText: ["contactInfoTextZh", "contactInfoTextEn"],
  activityIntro: ["activityIntroZh", "activityIntroEn"],
};

function applyServerContent(payload) {
  if (!payload?.profile || !Array.isArray(payload.entries)) return false;
  for (const [key, [zhField, enField]] of Object.entries(PROFILE_TRANSLATION_FIELDS)) {
    const zhValue = payload.profile[zhField];
    const enValue = payload.profile[enField];
    if (typeof zhValue !== "string" || typeof enValue !== "string") return false;
    translations.zh[key] = zhValue;
    translations.en[key] = enValue;
  }
  state.artist = {
    ...state.artist,
    name: payload.profile.artistNameZh,
    nameEn: payload.profile.artistNameEn,
    bioZh: payload.profile.artistBioZh,
    bioEn: payload.profile.artistBioEn,
  };
  state.timeline = payload.entries
    .filter((entry) => entry.kind === "timeline")
    .map((entry) => ({ year: entry.yearLabel, zh: entry.bodyZh, en: entry.bodyEn }));
  state.contentEntries = payload.entries.filter((entry) => entry.kind !== "timeline");
  return true;
}

async function loadPublicContent() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/api/content", {
      headers: { accept: "application/json" },
      cache: "no-cache",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    return applyServerContent(await response.json());
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function applyServerArtworks(payload) {
  if (!Array.isArray(payload?.artworks) || payload.artworks.length === 0) return false;
  const currentById = new Map(state.works.map((work) => [work.id, work]));
  const nextWorks = [];
  for (const artwork of payload.artworks) {
    const current = currentById.get(artwork?.id);
    const image = typeof artwork?.image === "string" ? artwork.image : "";
    if (
      !["available", "held", "sold", "not_for_sale", "unconfirmed"].includes(artwork.saleStatus) ||
      (image !== "" && !/^\/(?:api\/media\/media-[0-9a-f-]{36}|assets\/[A-Za-z0-9][A-Za-z0-9._/-]*)$/.test(image))
    ) return false;
    nextWorks.push({
      id: artwork.id,
      price: "",
      hidePrice: true,
      ...(current || {}),
      titleZh: artwork.titleZh,
      titleEn: artwork.titleEn,
      category: artwork.category,
      medium: artwork.medium,
      size: artwork.dimensions,
      year: String(artwork.year),
      image,
      descriptionZh: artwork.descriptionZh,
      descriptionEn: artwork.descriptionEn,
      status: artwork.saleStatus,
    });
  }
  state.works = nextWorks;
  return true;
}

async function loadPublicArtworks() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/api/artworks", {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    return applyServerArtworks(await response.json());
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

const STATIC_DETAIL_IDS = new Set([
  "cai-lusheng",
  "flower-2025",
  "grass-2024",
  "jiangnan-2024",
  "jiangnan-series-6",
  "jiangnan-trip",
  "ta-series-5",
]);

function workDetailHref(workId) {
  return STATIC_DETAIL_IDS.has(workId)
    ? `works/${workId}${state.language === "en" ? "-en" : ""}.html`
    : `gallery.html?work=${encodeURIComponent(workId)}#workDetail`;
}

function readImage(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsDataURL(file);
}
