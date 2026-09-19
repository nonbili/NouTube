import ExpoModulesCore
import StoreKit
import UIKit
struct NouBillingProductRecord: Record {
  @Field
  var id: String = ""

  @Field
  var title: String = ""

  @Field
  var description: String = ""

  @Field
  var displayPrice: String = ""
}

struct NouBillingEntitlementRecord: Record {
  @Field
  var transactionId: String = ""

  @Field
  var originalTransactionId: String = ""

  @Field
  var productId: String = ""

  @Field
  var purchaseDate: String = ""

  @Field
  var expirationDate: String? = nil

  @Field
  var revocationDate: String? = nil

  @Field
  var appAccountToken: String? = nil

  @Field
  var environment: String? = nil

  @Field
  var signedTransactionInfo: String = ""
}

public class NouBillingModule: Module {
  private var updatesTask: Task<Void, Never>?

  public func definition() -> ModuleDefinition {
    Name("NouBilling")

    Events("onTransactionUpdated")

    // Ask to Buy approvals, renewals, refunds and purchases made on other
    // devices arrive here rather than as a purchase() result. They stay
    // unfinished until JS has synced them to the backend and calls
    // finishTransaction, so a missed event is picked up again by
    // getUnfinishedTransactions.
    OnStartObserving {
      self.startObservingUpdates()
    }

    OnStopObserving {
      self.updatesTask?.cancel()
      self.updatesTask = nil
    }

    AsyncFunction("getProducts") { (productIds: [String]) async throws -> [NouBillingProductRecord] in
      let products = try await Product.products(for: productIds)
      return products.map { product in
        NouBillingProductRecord(
          id: product.id,
          title: product.displayName,
          description: product.description,
          displayPrice: product.displayPrice
        )
      }
    }

    AsyncFunction("purchase") { (productId: String, appAccountToken: String) async throws -> NouBillingEntitlementRecord in
      let products = try await Product.products(for: [productId])
      guard let product = products.first else {
        throw NSError(domain: "NouBilling", code: 404, userInfo: [NSLocalizedDescriptionKey: "Product not found"])
      }
      guard let token = UUID(uuidString: appAccountToken) else {
        throw NSError(domain: "NouBilling", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid app account token"])
      }

      let result = try await product.purchase(options: [.appAccountToken(token)])
      switch result {
      case .success(let verification):
        // Finished by finishTransaction once the backend has the purchase.
        _ = try self.unwrap(verification)
        return self.serialize(verification)
      case .pending:
        throw NSError(domain: "NouBilling", code: 202, userInfo: [NSLocalizedDescriptionKey: "Purchase pending approval"])
      case .userCancelled:
        throw NSError(domain: "NouBilling", code: 499, userInfo: [NSLocalizedDescriptionKey: "Purchase cancelled"])
      @unknown default:
        throw NSError(domain: "NouBilling", code: 500, userInfo: [NSLocalizedDescriptionKey: "Unknown purchase result"])
      }
    }

    AsyncFunction("restore") { () async throws -> [NouBillingEntitlementRecord] in
      try await AppStore.sync()
      return try await self.collectCurrentEntitlements()
    }

    AsyncFunction("getUnfinishedTransactions") { () async -> [NouBillingEntitlementRecord] in
      var records: [NouBillingEntitlementRecord] = []
      for await verification in StoreKit.Transaction.unfinished {
        if case .verified = verification {
          records.append(self.serialize(verification))
        }
      }
      return records
    }

    AsyncFunction("finishTransaction") { (transactionId: String) async in
      for await verification in StoreKit.Transaction.unfinished {
        if case .verified(let transaction) = verification, String(transaction.id) == transactionId {
          await transaction.finish()
          return
        }
      }
    }

    AsyncFunction("manageSubscriptions") { () async throws in
      guard let scene = self.getActiveScene() else {
        throw NSError(domain: "NouBilling", code: 500, userInfo: [NSLocalizedDescriptionKey: "No active scene"])
      }
      try await AppStore.showManageSubscriptions(in: scene)
    }
  }

  private func startObservingUpdates() {
    updatesTask?.cancel()
    updatesTask = Task { [weak self] in
      for await verification in StoreKit.Transaction.updates {
        guard let self, case .verified = verification else {
          continue
        }
        self.sendEvent("onTransactionUpdated", self.serialize(verification).toDictionary())
      }
    }
  }

  private func unwrap<T>(_ verification: VerificationResult<T>) throws -> T {
    switch verification {
    case .verified(let value):
      return value
    case .unverified(_, let error):
      throw error
    }
  }

  private func collectCurrentEntitlements() async throws -> [NouBillingEntitlementRecord] {
    var records: [NouBillingEntitlementRecord] = []
    for await verification in StoreKit.Transaction.currentEntitlements {
      _ = try unwrap(verification)
      records.append(serialize(verification))
    }
    return records
  }

  private func serialize(_ verification: VerificationResult<StoreKit.Transaction>) -> NouBillingEntitlementRecord {
    let transaction: StoreKit.Transaction
    switch verification {
    case .verified(let value):
      transaction = value
    case .unverified(let value, _):
      transaction = value
    }

    return NouBillingEntitlementRecord(
      transactionId: String(transaction.id),
      originalTransactionId: String(transaction.originalID),
      productId: transaction.productID,
      purchaseDate: transaction.purchaseDate.ISO8601Format(),
      expirationDate: transaction.expirationDate?.ISO8601Format(),
      revocationDate: transaction.revocationDate?.ISO8601Format(),
      appAccountToken: transaction.appAccountToken?.uuidString.lowercased(),
      environment: transaction.environment.rawValue,
      signedTransactionInfo: verification.jwsRepresentation
    )
  }

  private func getActiveScene() -> UIWindowScene? {
    UIApplication.shared.connectedScenes
      .first { $0.activationState == .foregroundActive } as? UIWindowScene
  }
}
